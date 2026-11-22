import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { testApp } from './test-app';

const INDEX = '<!doctype html><html><body><div id="root"></div></body></html>';

function webRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'web-dist-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), INDEX);
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)');
  return dir;
}

describe('serving the web app (PL-8)', () => {
  it('AC1: GET / returns the web app index.html', async () => {
    const t = await testApp({ webRoot: webRoot() });
    const res = await t.call('GET', '/');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toBe(INDEX);
  });

  it('AC1: built assets are served with their own content', async () => {
    const t = await testApp({ webRoot: webRoot() });
    const res = await t.call('GET', '/assets/app.js');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('console.log(1)');
  });

  it('AC2: /health and /api routes keep working', async () => {
    const t = await testApp({ webRoot: webRoot() });
    expect((await t.call('GET', '/health')).json()).toEqual({ status: 'ok' });
    const spec = await t.call('GET', '/api/openapi.json');
    expect(spec.statusCode).toBe(200);
    expect(spec.json().openapi).toBeDefined();
  });

  it('AC2: extension-less unknown paths return index.html so client routes survive reload', async () => {
    const t = await testApp({ webRoot: webRoot() });
    const res = await t.call('GET', '/projects/42/layout');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(INDEX);
  });

  it('AC2: unknown /api paths stay JSON 404s, never index.html', async () => {
    const t = await testApp({ webRoot: webRoot() });
    for (const url of ['/api/nope', '/api']) {
      const res = await t.call('GET', url);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: { code: 'not_found', message: 'Not found' } });
    }
  });

  it('AC2: missing file-like paths answer 404, not index.html', async () => {
    const t = await testApp({ webRoot: webRoot() });
    const res = await t.call('GET', '/assets/missing.js');
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('<html');
  });

  it('AC2: non-GET requests to unknown paths are 404, not index.html', async () => {
    const t = await testApp({ webRoot: webRoot() });
    const res = await t.call('POST', '/projects/42', {});
    expect(res.statusCode).toBe(404);
  });
});

describe('web app in the image (PL-8)', () => {
  const dockerfile = readFileSync(
    fileURLToPath(new URL('../../../Dockerfile', import.meta.url)),
    'utf8',
  );

  it('AC3: the Dockerfile runs the production build of the web app', () => {
    expect(dockerfile).toMatch(/^RUN .*@factory-sim\/web build/m);
  });

  it('AC3: the container does not start a Vite dev server', () => {
    const cmd = dockerfile.match(/^CMD .*$/m)?.[0] ?? '';
    expect(cmd).not.toMatch(/vite/);
    expect(cmd).toContain('src/main.ts');
  });
});

describe('trusted proxies (#64)', () => {
  const guess = async (t: Awaited<ReturnType<typeof testApp>>, peer: string, xff: string) =>
    t.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      remoteAddress: peer,
      headers: { 'x-forwarded-for': xff },
      payload: { email: 'a@plant.test', password: 'wrong password!' },
    });

  it('AC3: X-Forwarded-For from an untrusted peer is ignored (throttle cannot be dodged)', async () => {
    const t = await testApp({ trustProxy: ['10.0.0.1'] });
    const codes: number[] = [];
    for (let i = 0; i < 8; i++)
      codes.push((await guess(t, '203.0.113.9', `198.51.100.${i}`)).statusCode);
    expect(codes).toContain(429);
  });

  it('AC3: X-Forwarded-For from a trusted proxy identifies the client', async () => {
    const t = await testApp({ trustProxy: ['10.0.0.1'] });
    const codes: number[] = [];
    for (let i = 0; i < 8; i++)
      codes.push((await guess(t, '10.0.0.1', `198.51.100.${i}`)).statusCode);
    expect(codes).not.toContain(429);
  });
});

describe('docs (#64)', () => {
  const read = (p: string) =>
    readFileSync(fileURLToPath(new URL(`../../../${p}`, import.meta.url)), 'utf8');

  it('AC2: deploy.md tells admins to publish the port on 127.0.0.1 behind a proxy', () => {
    const doc = read('docs/deploy.md');
    expect(doc).toContain('TRUST_PROXY');
    expect(doc).toContain('127.0.0.1');
  });

  it('AC1: .env.example documents TRUST_PROXY', () => {
    expect(read('.env.example')).toContain('TRUST_PROXY');
  });
});

describe('web app polish (PL-8 review)', () => {
  it('N1: HEAD on a client route gets the index.html headers, not a 404', async () => {
    const t = await testApp({ webRoot: webRoot() });
    const res = await t.app.inject({ method: 'HEAD', url: '/projects/42' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('N2: assets are cached immutably and index.html is revalidated', async () => {
    const t = await testApp({ webRoot: webRoot() });
    const asset = await t.call('GET', '/assets/app.js');
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    for (const url of ['/', '/projects/42']) {
      expect((await t.call('GET', url)).headers['cache-control']).toBe('no-cache');
    }
  });

  it('N3: deploy.md says the gateway example is safe only with the 127.0.0.1 binding', () => {
    const doc = readFileSync(
      fileURLToPath(new URL('../../../docs/deploy.md', import.meta.url)),
      'utf8',
    );
    expect(doc).toMatch(/safe only[^\n]*127\.0\.0\.1/);
  });
});

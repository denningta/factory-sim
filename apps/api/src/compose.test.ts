import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

interface Service {
  restart?: string;
  volumes?: string[];
  ports?: string[];
  healthcheck?: { test?: string[] };
  depends_on?: Record<string, { condition?: string }>;
}
const file = fileURLToPath(new URL('../../../docker-compose.yml', import.meta.url));
const compose = parse(readFileSync(file, 'utf8')) as {
  services: Record<string, Service>;
  volumes?: Record<string, unknown>;
};

describe('docker-compose.yml', () => {
  it('AC1: defines app and postgres, publishing the app on APP_PORT', () => {
    expect(Object.keys(compose.services).sort()).toEqual(['app', 'postgres']);
    expect(compose.services.app?.ports?.join()).toContain('${APP_PORT');
  });

  it('AC1: postgres data lives in a named volume', () => {
    expect(Object.keys(compose.volumes ?? {})).toEqual(['pgdata']);
    expect(compose.services.postgres?.volumes).toContain('pgdata:/var/lib/postgresql/data');
  });

  it('AC2: postgres has a healthcheck and the app waits for it to be healthy', () => {
    expect(compose.services.postgres?.healthcheck?.test?.join(' ')).toContain('pg_isready');
    expect(compose.services.app?.depends_on?.postgres?.condition).toBe('service_healthy');
  });

  it('AC3: both containers restart automatically after a host reboot', () => {
    for (const name of ['app', 'postgres']) {
      expect(['always', 'unless-stopped']).toContain(compose.services[name]?.restart);
    }
  });
});

describe('deployment hardening (PL-7)', () => {
  const root = (p: string) =>
    readFileSync(fileURLToPath(new URL(`../../../${p}`, import.meta.url)), 'utf8');

  it('AC2: the app image switches to the non-root node user', () => {
    const users = root('Dockerfile').match(/^USER\s+(\S+)/gm) ?? [];
    expect(users.at(-1)).toBe('USER node');
  });

  it('AC3: deploy.md health check uses the configured port, not a hard-coded one', () => {
    const doc = root('docs/deploy.md');
    expect(doc).toMatch(/curl[^\n]*\$\{APP_PORT/);
    expect(doc).not.toMatch(/curl[^\n]*localhost:8080/);
  });

  it('AC3: deploy.md backup writes to a host file via -T and redirection', () => {
    expect(root('docs/deploy.md')).toMatch(/exec -T postgres pg_dump[^\n]*>\s*\S+\.sql/);
  });

  it('AC3: deploy.md explains the password in both POSTGRES_PASSWORD and DATABASE_URL', () => {
    const doc = root('docs/deploy.md');
    expect(doc).toContain('POSTGRES_PASSWORD');
    expect(doc).toMatch(/DATABASE_URL[^\n]*(both|same)|(both|same)[^\n]*DATABASE_URL/);
  });
});

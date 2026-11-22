import { describe, expect, it } from 'vitest';
import { testApp } from './test-app';

describe('api server', () => {
  it('AC1: responds 200 on /health so the app is reachable', async () => {
    const t = await testApp();
    const res = await t.call('GET', '/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('AC2: unknown routes answer the ApiError shape', async () => {
    const t = await testApp();
    const res = await t.call('GET', '/api/nope');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'not_found', message: 'Not found' } });
  });

  it('AC2: an oversized body answers 413 payload_too_large', async () => {
    const t = await testApp();
    const res = await t.call('POST', '/api/auth/login', {
      email: 'a@b.co',
      password: 'x'.repeat(2_000_000),
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe('payload_too_large');
  });
});

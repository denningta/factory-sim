import { describe, expect, it } from 'vitest';
import { buildServer } from './server';

describe('api server', () => {
  it('AC1: responds 200 on /health so the app is reachable', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

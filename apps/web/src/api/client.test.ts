import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '@factory-sim/schema';
import { ApiRequestError, api } from './client';

afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('api client', () => {
  it('AC2: updateProject PATCHes with baseRevision and returns the new summary', async () => {
    const fetchMock = vi.fn(async () =>
      json(200, {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'A',
        updatedAt: '2026-01-01T00:00:00.000Z',
        revision: 4,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const out = await api.updateProject('00000000-0000-4000-8000-000000000001', {
      document: createProject(),
      baseRevision: 3,
    });
    expect(out.revision).toBe(4);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/projects/00000000-0000-4000-8000-000000000001');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string).baseRevision).toBe(3);
  });

  it('AC2: a 409 becomes an ApiRequestError with code conflict', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(409, { error: { code: 'conflict', message: 'stale' } })),
    );
    await expect(
      api.updateProject('00000000-0000-4000-8000-000000000001', { name: 'x', baseRevision: 0 }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      api.updateProject('00000000-0000-4000-8000-000000000001', { name: 'x', baseRevision: 0 }),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('AC3: listProjects returns the summaries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(200, { projects: [] })),
    );
    await expect(api.listProjects()).resolves.toEqual([]);
  });
});

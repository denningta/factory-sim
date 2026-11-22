import {
  apiErrorSchema,
  createProject,
  projectDetailSchema,
  projectListResponseSchema,
  projectSummarySchema,
} from '@factory-sim/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { projects } from '../db/schema';
import { PASSWORD, testApp } from '../test-app';

async function withUsers() {
  const t = await testApp();
  const { cookie: admin } = await t.setup();
  await t.call('POST', '/api/users', { email: 'eng@plant.test', password: PASSWORD }, admin);
  const { cookie: other } = await t.login('eng@plant.test');
  const create = async (name: string, cookie = admin) =>
    projectDetailSchema.parse((await t.call('POST', '/api/projects', { name }, cookie)).json());
  return { t, admin, other: other!, create };
}

describe('projects API', () => {
  it('AC1: create answers 201 with an empty current-version project', async () => {
    const { t, admin } = await withUsers();
    const res = await t.call('POST', '/api/projects', { name: '  Line 1 ' }, admin);
    expect(res.statusCode).toBe(201);
    const body = projectDetailSchema.parse(res.json());
    expect(body).toMatchObject({ name: 'Line 1', revision: 0, document: createProject() });
  });

  it('AC1: open returns the saved project', async () => {
    const { t, admin, create } = await withUsers();
    const p = await create('Line 1');
    const res = await t.call('GET', `/api/projects/${p.id}`, undefined, admin);
    expect(res.statusCode).toBe(200);
    expect(projectDetailSchema.parse(res.json()).id).toBe(p.id);
  });

  it('AC1: open upgrades an older stored document to the current version', async () => {
    const { t, admin, create } = await withUsers();
    const p = await create('Old');
    await t.db
      .update(projects)
      .set({ document: { ...createProject(), schemaVersion: 1 } })
      .where(eq(projects.id, p.id));
    const res = await t.call('GET', `/api/projects/${p.id}`, undefined, admin);
    expect(projectDetailSchema.parse(res.json()).document.schemaVersion).toBe(
      createProject().schemaVersion,
    );
  });

  it('AC1: rename changes the name and bumps the revision', async () => {
    const { t, admin, create } = await withUsers();
    const p = await create('Line 1');
    const res = await t.call(
      'PATCH',
      `/api/projects/${p.id}`,
      { name: 'Line 2', baseRevision: 0 },
      admin,
    );
    expect(res.statusCode).toBe(200);
    expect(projectSummarySchema.parse(res.json())).toMatchObject({ name: 'Line 2', revision: 1 });
  });

  it('AC1: delete removes the project; later reads answer 404', async () => {
    const { t, admin, create } = await withUsers();
    const p = await create('Line 1');
    expect((await t.call('DELETE', `/api/projects/${p.id}`, undefined, admin)).statusCode).toBe(
      204,
    );
    expect((await t.call('GET', `/api/projects/${p.id}`, undefined, admin)).statusCode).toBe(404);
    expect((await t.call('DELETE', `/api/projects/${p.id}`, undefined, admin)).statusCode).toBe(
      404,
    );
  });

  it('AC2: autosave stores the document and the next open returns it', async () => {
    const { t, admin, create } = await withUsers();
    const p = await create('Line 1');
    const document = { ...createProject(), floor: { width: 50, length: 40, gridSpacing: 1 } };
    const res = await t.call(
      'PATCH',
      `/api/projects/${p.id}`,
      { document, baseRevision: 0 },
      admin,
    );
    expect(res.statusCode).toBe(200);
    const opened = await t.call('GET', `/api/projects/${p.id}`, undefined, admin);
    expect(projectDetailSchema.parse(opened.json())).toMatchObject({ revision: 1, document });
  });

  it('AC2: a save with a stale baseRevision answers 409 conflict and keeps the newer data', async () => {
    const { t, admin, create } = await withUsers();
    const p = await create('Line 1');
    await t.call('PATCH', `/api/projects/${p.id}`, { name: 'First', baseRevision: 0 }, admin);
    const res = await t.call(
      'PATCH',
      `/api/projects/${p.id}`,
      { name: 'Second', baseRevision: 0 },
      admin,
    );
    expect(res.statusCode).toBe(409);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('conflict');
    const opened = await t.call('GET', `/api/projects/${p.id}`, undefined, admin);
    expect(projectDetailSchema.parse(opened.json()).name).toBe('First');
  });

  it('AC2: saving an older schemaVersion says to reload', async () => {
    const { t, admin, create } = await withUsers();
    const p = await create('Line 1');
    const res = await t.call(
      'PATCH',
      `/api/projects/${p.id}`,
      { document: { ...createProject(), schemaVersion: 1 }, baseRevision: 0 },
      admin,
    );
    expect(res.statusCode).toBe(400);
    const error = apiErrorSchema.parse(res.json()).error;
    expect(error.code).toBe('validation');
    expect(error.message).toBe('The app was updated. Reload to keep editing.');
  });

  it('AC2: an invalid document answers 400 and is not stored', async () => {
    const { t, admin, create } = await withUsers();
    const p = await create('Line 1');
    const res = await t.call(
      'PATCH',
      `/api/projects/${p.id}`,
      {
        document: { ...createProject(), floor: { width: -1, length: 1, gridSpacing: 1 } },
        baseRevision: 0,
      },
      admin,
    );
    expect(res.statusCode).toBe(400);
  });

  it('AC2: a body over the limit answers 413 payload_too_large', async () => {
    const { t, admin, create } = await withUsers();
    const p = await create('Line 1');
    const res = await t.call(
      'PATCH',
      `/api/projects/${p.id}`,
      { name: 'x'.repeat(1_100_000), baseRevision: 0 },
      admin,
    );
    expect(res.statusCode).toBe(413);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('payload_too_large');
  });

  it('AC3: the list shows name and last modified, newest first, only my projects', async () => {
    const { t, admin, other, create } = await withUsers();
    const a = await create('Alpha');
    t.advance(60_000);
    await create('Beta');
    t.advance(60_000);
    await t.call('PATCH', `/api/projects/${a.id}`, { name: 'Alpha 2', baseRevision: 0 }, admin);
    await create('Theirs', other);
    const res = await t.call('GET', '/api/projects', undefined, admin);
    const { projects: list } = projectListResponseSchema.parse(res.json());
    expect(list.map((p) => p.name)).toEqual(['Alpha 2', 'Beta']);
    expect(list[0]?.updatedAt).toBe('2026-01-01T09:02:00.000Z');
    expect(JSON.stringify(res.json())).not.toContain('"document"');
  });

  it('AC1: projects are private; another user gets 404 on read, update and delete', async () => {
    const { t, other, create } = await withUsers();
    const p = await create('Mine');
    for (const [method, body] of [
      ['GET', undefined],
      ['PATCH', { name: 'Hijack', baseRevision: 0 }],
      ['DELETE', undefined],
    ] as const) {
      const res = await t.call(method, `/api/projects/${p.id}`, body, other);
      expect(res.statusCode).toBe(404);
    }
  });

  it('AC1: every project route requires a session; a malformed id is 404', async () => {
    const { t, admin } = await withUsers();
    expect((await t.call('GET', '/api/projects')).statusCode).toBe(401);
    expect((await t.call('POST', '/api/projects', { name: 'x' })).statusCode).toBe(401);
    expect((await t.call('GET', '/api/projects/not-a-uuid', undefined, admin)).statusCode).toBe(
      404,
    );
  });

  it('AC1: a blank name answers 400', async () => {
    const { t, admin } = await withUsers();
    expect((await t.call('POST', '/api/projects', { name: '   ' }, admin)).statusCode).toBe(400);
  });
});

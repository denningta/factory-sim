import {
  BASE_EQUIPMENT_TYPES,
  apiErrorSchema,
  defaultPorts,
  equipmentTypeListResponseSchema,
  userEquipmentTypeSchema,
  type UserEquipmentType,
} from '@factory-sim/schema';
import { describe, expect, it } from 'vitest';
import { PASSWORD, testApp } from '../test-app';

const cnc = (id: string, name = '5-axis CNC'): UserEquipmentType => ({
  id,
  name,
  behavior: 'workstation',
  params: { capacity: 1, batchSize: 1, labor: { mode: 'manual' } },
  footprint: { width: 3, length: 2.5 },
  height: 2.4,
  color: '#2f6f9f',
  ports: defaultPorts('workstation'),
});
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

async function withUsers() {
  const t = await testApp();
  const { cookie: admin } = await t.setup();
  await t.call('POST', '/api/users', { email: 'eng@plant.test', password: PASSWORD }, admin);
  const { cookie: other } = await t.login('eng@plant.test');
  return { t, admin, other: other! };
}

describe('equipment library API (EQ-3)', () => {
  it('AC1: creating a type stores behavior, name, footprint, height, color and params', async () => {
    const { t, admin } = await withUsers();
    const res = await t.call('POST', '/api/equipment-types', cnc(A), admin);
    expect(res.statusCode).toBe(201);
    expect(userEquipmentTypeSchema.parse(res.json())).toEqual(cnc(A));
  });

  it('AC1: rejects a type whose params do not match its behavior', async () => {
    const { t, admin } = await withUsers();
    const bad = { ...cnc(A), params: { capacity: 10 } };
    const res = await t.call('POST', '/api/equipment-types', bad, admin);
    expect(res.statusCode).toBe(400);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('validation');
  });

  it('AC2: the new type appears in my library, sorted by name, and survives reloads', async () => {
    const { t, admin } = await withUsers();
    await t.call('POST', '/api/equipment-types', cnc(B, 'lathe'), admin);
    await t.call('POST', '/api/equipment-types', cnc(A, 'Anodizing'), admin);
    const res = await t.call('GET', '/api/equipment-types', undefined, admin);
    expect(res.statusCode).toBe(200);
    expect(equipmentTypeListResponseSchema.parse(res.json()).types.map((x) => x.name)).toEqual([
      'Anodizing',
      'lathe',
    ]);
  });

  it('AC2: the library is the same whichever project is open (not tied to a project)', async () => {
    const { t, admin } = await withUsers();
    await t.call('POST', '/api/equipment-types', cnc(A), admin);
    await t.call('POST', '/api/projects', { name: 'Line 1' }, admin);
    await t.call('POST', '/api/projects', { name: 'Line 2' }, admin);
    const res = await t.call('GET', '/api/equipment-types', undefined, admin);
    expect(equipmentTypeListResponseSchema.parse(res.json()).types).toHaveLength(1);
  });

  it('AC2: types are private to their creator', async () => {
    const { t, admin, other } = await withUsers();
    await t.call('POST', '/api/equipment-types', cnc(A), admin);
    const list = await t.call('GET', '/api/equipment-types', undefined, other);
    expect(equipmentTypeListResponseSchema.parse(list.json()).types).toEqual([]);
    expect((await t.call('PUT', `/api/equipment-types/${A}`, cnc(A), other)).statusCode).toBe(404);
    expect((await t.call('DELETE', `/api/equipment-types/${A}`, undefined, other)).statusCode).toBe(
      404,
    );
  });

  it('AC2: a duplicate id answers 409 and an id clashing with a built-in is rejected', async () => {
    const { t, admin } = await withUsers();
    await t.call('POST', '/api/equipment-types', cnc(A), admin);
    expect((await t.call('POST', '/api/equipment-types', cnc(A), admin)).statusCode).toBe(409);
    const clash = { ...cnc(A), id: BASE_EQUIPMENT_TYPES[0]!.id };
    expect((await t.call('POST', '/api/equipment-types', clash, admin)).statusCode).toBe(400);
  });

  it('AC2: requires a session', async () => {
    const { t } = await withUsers();
    expect((await t.call('GET', '/api/equipment-types')).statusCode).toBe(401);
    expect((await t.call('POST', '/api/equipment-types', cnc(A))).statusCode).toBe(401);
  });

  it('AC3: editing replaces the type; the id in the body must match the URL', async () => {
    const { t, admin } = await withUsers();
    await t.call('POST', '/api/equipment-types', cnc(A), admin);
    const edited = { ...cnc(A, '5-axis CNC mk2'), height: 3 };
    const res = await t.call('PUT', `/api/equipment-types/${A}`, edited, admin);
    expect(res.statusCode).toBe(200);
    expect(userEquipmentTypeSchema.parse(res.json())).toEqual(edited);
    const mismatch = await t.call('PUT', `/api/equipment-types/${A}`, cnc(B), admin);
    expect(mismatch.statusCode).toBe(400);
    expect((await t.call('PUT', `/api/equipment-types/${B}`, cnc(B), admin)).statusCode).toBe(404);
  });

  it('AC2: delete removes the type from the library', async () => {
    const { t, admin } = await withUsers();
    await t.call('POST', '/api/equipment-types', cnc(A), admin);
    expect((await t.call('DELETE', `/api/equipment-types/${A}`, undefined, admin)).statusCode).toBe(
      204,
    );
    const res = await t.call('GET', '/api/equipment-types', undefined, admin);
    expect(equipmentTypeListResponseSchema.parse(res.json()).types).toEqual([]);
  });

  it('AC3: editing or deleting a type leaves saved projects untouched', async () => {
    const { t, admin } = await withUsers();
    await t.call('POST', '/api/equipment-types', cnc(A), admin);
    const created = (await t.call('POST', '/api/projects', { name: 'Line 1' }, admin)).json();
    await t.call('PUT', `/api/equipment-types/${A}`, { ...cnc(A), height: 3 }, admin);
    await t.call('DELETE', `/api/equipment-types/${A}`, undefined, admin);
    const after = (await t.call('GET', `/api/projects/${created.id}`, undefined, admin)).json();
    expect(after.revision).toBe(created.revision);
  });
});

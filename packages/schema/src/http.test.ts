import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  BASE_EQUIPMENT_TYPES,
  apiErrorSchema,
  equipmentTypeListResponseSchema,
  userEquipmentTypeSchema,
  changePasswordRequestSchema,
  resetPasswordRequestSchema,
  createProject,
  createUserRequestSchema,
  loginRequestSchema,
  projectDetailSchema,
  setupRequestSchema,
  updateProjectRequestSchema,
  updateUserRequestSchema,
} from './index';

const longPassword = 'x'.repeat(PASSWORD_MIN_LENGTH);
const uuid = '7f1c3a52-9d4e-4b7a-8c2f-1e6d5b4a3c21';
const now = '2026-11-22T10:00:00.000Z';

describe('HTTP contract: auth (PL-6)', () => {
  it('normalizes emails so sign-in is case-insensitive', () => {
    const parsed = loginRequestSchema.parse({ email: '  Tim@Example.COM ', password: 'p' });
    expect(parsed.email).toBe('tim@example.com');
  });

  it('rejects malformed emails', () => {
    expect(loginRequestSchema.safeParse({ email: 'not-an-email', password: 'p' }).success).toBe(
      false,
    );
  });

  it('applies the password policy to new passwords only', () => {
    const short = 'x'.repeat(PASSWORD_MIN_LENGTH - 1);
    const setup = setupRequestSchema.safeParse({ email: 'a@b.co', password: short });
    expect(setup.success).toBe(false);
    if (!setup.success) expect(setup.error.issues[0]?.message).toMatch(/at least/);
    expect(setupRequestSchema.safeParse({ email: 'a@b.co', password: longPassword }).success).toBe(
      true,
    );
    expect(loginRequestSchema.safeParse({ email: 'a@b.co', password: short }).success).toBe(true);
  });

  it('caps password length to bound hashing work', () => {
    const huge = 'x'.repeat(10_000);
    expect(loginRequestSchema.safeParse({ email: 'a@b.co', password: huge }).success).toBe(false);
  });

  it('creates plain users by default', () => {
    const parsed = createUserRequestSchema.parse({ email: 'a@b.co', password: longPassword });
    expect(parsed.role).toBe('user');
  });

  it('rejects an empty user update', () => {
    expect(updateUserRequestSchema.safeParse({}).success).toBe(false);
    expect(updateUserRequestSchema.safeParse({ disabled: true }).success).toBe(true);
  });
});

describe('HTTP contract: passwords (PL-9)', () => {
  it('changing a password needs the current one and a policy-compliant new one', () => {
    expect(
      changePasswordRequestSchema.safeParse({ currentPassword: 'old', newPassword: longPassword })
        .success,
    ).toBe(true);
    expect(
      changePasswordRequestSchema.safeParse({ currentPassword: '', newPassword: longPassword })
        .success,
    ).toBe(false);
    expect(
      changePasswordRequestSchema.safeParse({ currentPassword: 'old', newPassword: 'short' })
        .success,
    ).toBe(false);
  });

  it('an admin reset applies the password policy', () => {
    expect(resetPasswordRequestSchema.safeParse({ newPassword: longPassword }).success).toBe(true);
    expect(resetPasswordRequestSchema.safeParse({ newPassword: 'short' }).success).toBe(false);
  });
});

describe('HTTP contract: projects (SC-1)', () => {
  it('returns the project document validated against the current schema', () => {
    const detail = {
      id: uuid,
      name: 'Line 1',
      updatedAt: now,
      revision: 0,
      document: createProject(),
    };
    expect(projectDetailSchema.safeParse(detail).success).toBe(true);
    const stale = { ...detail, document: { ...createProject(), schemaVersion: 0 } };
    expect(projectDetailSchema.safeParse(stale).success).toBe(false);
  });

  it('requires baseRevision on updates so autosave cannot silently overwrite', () => {
    expect(updateProjectRequestSchema.safeParse({ name: 'Renamed' }).success).toBe(false);
    expect(updateProjectRequestSchema.safeParse({ name: 'Renamed', baseRevision: 3 }).success).toBe(
      true,
    );
    expect(updateProjectRequestSchema.safeParse({ name: 'X', baseRevision: 1.5 }).success).toBe(
      false,
    );
  });

  it('rejects an update with nothing to change, and blank names', () => {
    expect(updateProjectRequestSchema.safeParse({ baseRevision: 3 }).success).toBe(false);
    expect(updateProjectRequestSchema.safeParse({ name: '   ', baseRevision: 3 }).success).toBe(
      false,
    );
  });
});

describe('HTTP contract: errors', () => {
  it('has one error shape with a known code', () => {
    expect(
      apiErrorSchema.safeParse({ error: { code: 'conflict', message: 'Changed elsewhere' } })
        .success,
    ).toBe(true);
    expect(apiErrorSchema.safeParse({ error: { code: 'teapot', message: '' } }).success).toBe(
      false,
    );
  });
});

describe('HTTP contract: equipment library (EQ-3)', () => {
  const cnc = {
    ...BASE_EQUIPMENT_TYPES[0]!,
    id: uuid,
    name: '5-axis CNC',
    color: '#336699',
  };

  it('accepts a user-defined type with a UUID id', () => {
    expect(userEquipmentTypeSchema.parse(cnc).name).toBe('5-axis CNC');
    expect(equipmentTypeListResponseSchema.parse({ types: [cnc] }).types).toHaveLength(1);
  });

  it('rejects ids that could collide with built-ins', () => {
    const r = userEquipmentTypeSchema.safeParse({ ...cnc, id: 'base-workstation' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['id']);
  });

  it('requires lowercase so ids round-trip through Postgres uuid', () => {
    expect(userEquipmentTypeSchema.safeParse({ ...cnc, id: uuid.toUpperCase() }).success).toBe(
      false,
    );
  });

  it('validates params against the base behavior', () => {
    const bad = { ...cnc, params: { capacity: 10 } };
    expect(userEquipmentTypeSchema.safeParse(bad).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  apiErrorSchema,
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

describe('HTTP contract: projects (SC-1)', () => {
  it('returns the project document validated against the current schema', () => {
    const detail = { id: uuid, name: 'Line 1', updatedAt: now, document: createProject() };
    expect(projectDetailSchema.safeParse(detail).success).toBe(true);
    const stale = { ...detail, document: { ...createProject(), schemaVersion: 0 } };
    expect(projectDetailSchema.safeParse(stale).success).toBe(false);
  });

  it('requires baseUpdatedAt on updates so autosave cannot silently overwrite', () => {
    expect(updateProjectRequestSchema.safeParse({ name: 'Renamed' }).success).toBe(false);
    expect(
      updateProjectRequestSchema.safeParse({ name: 'Renamed', baseUpdatedAt: now }).success,
    ).toBe(true);
  });

  it('rejects an update with nothing to change, and blank names', () => {
    expect(updateProjectRequestSchema.safeParse({ baseUpdatedAt: now }).success).toBe(false);
    expect(updateProjectRequestSchema.safeParse({ name: '   ', baseUpdatedAt: now }).success).toBe(
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

import { apiErrorSchema, userSchema } from '@factory-sim/schema';
import { describe, expect, it } from 'vitest';
import { sessions } from '../db/schema';
import { PASSWORD, testApp } from '../test-app';

async function withUser() {
  const t = await testApp();
  const { cookie: admin } = await t.setup();
  const created = await t.call(
    'POST',
    '/api/users',
    { email: 'Eng@plant.test', password: PASSWORD },
    admin,
  );
  const user = userSchema.parse(created.json());
  const { cookie } = await t.login('eng@plant.test');
  return { t, admin, user, userCookie: cookie! };
}

describe('user administration', () => {
  it('AC4: an admin creates a user who can then sign in', async () => {
    const { t, user } = await withUser();
    expect(user).toMatchObject({ email: 'eng@plant.test', role: 'user', disabled: false });
    expect((await t.login('eng@plant.test')).res.statusCode).toBe(200);
  });

  it('AC4: an admin lists users', async () => {
    const { t, admin } = await withUser();
    const res = await t.call('GET', '/api/users', undefined, admin);
    expect(
      res
        .json()
        .users.map((u: { email: string }) => u.email)
        .sort(),
    ).toEqual(['admin@plant.test', 'eng@plant.test']);
    expect(JSON.stringify(res.json())).not.toMatch(/argon|passwordHash/);
  });

  it('AC4: a non-admin gets 403 on every user route', async () => {
    const { t, user, userCookie } = await withUser();
    for (const [method, url, body] of [
      ['GET', '/api/users', undefined],
      ['POST', '/api/users', { email: 'x@plant.test', password: PASSWORD }],
      ['PATCH', `/api/users/${user.id}`, { disabled: true }],
    ] as const) {
      const res = await t.call(method, url, body, userCookie);
      expect(res.statusCode).toBe(403);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe('forbidden');
    }
  });

  it('AC4: a duplicate email answers 409 conflict', async () => {
    const { t, admin } = await withUser();
    const res = await t.call(
      'POST',
      '/api/users',
      { email: 'ENG@plant.test', password: PASSWORD },
      admin,
    );
    expect(res.statusCode).toBe(409);
  });

  it('AC4: a short password for a new user answers 400', async () => {
    const { t, admin } = await withUser();
    const res = await t.call(
      'POST',
      '/api/users',
      { email: 'n@plant.test', password: 'short' },
      admin,
    );
    expect(res.statusCode).toBe(400);
  });

  it('AC4: disabling a user ends their sessions at once and blocks sign-in', async () => {
    const { t, admin, user, userCookie } = await withUser();
    expect((await t.call('GET', '/api/auth/session', undefined, userCookie)).statusCode).toBe(200);
    const res = await t.call('PATCH', `/api/users/${user.id}`, { disabled: true }, admin);
    expect(userSchema.parse(res.json()).disabled).toBe(true);
    expect((await t.call('GET', '/api/auth/session', undefined, userCookie)).statusCode).toBe(401);
    expect((await t.login('eng@plant.test')).res.statusCode).toBe(401);
    expect(await t.db.select().from(sessions)).toHaveLength(1); // only the admin's
  });

  it('AC4: re-enabling a user lets them sign in again', async () => {
    const { t, admin, user } = await withUser();
    await t.call('PATCH', `/api/users/${user.id}`, { disabled: true }, admin);
    await t.call('PATCH', `/api/users/${user.id}`, { disabled: false }, admin);
    expect((await t.login('eng@plant.test')).res.statusCode).toBe(200);
  });

  it('AC4: promoting and demoting takes effect on the next request', async () => {
    const { t, admin, user, userCookie } = await withUser();
    await t.call('PATCH', `/api/users/${user.id}`, { role: 'admin' }, admin);
    expect((await t.call('GET', '/api/users', undefined, userCookie)).statusCode).toBe(200);
    await t.call('PATCH', `/api/users/${user.id}`, { role: 'user' }, admin);
    expect((await t.call('GET', '/api/users', undefined, userCookie)).statusCode).toBe(403);
  });

  it('AC4: an admin cannot disable or demote themself', async () => {
    const { t, admin } = await withUser();
    const me = (await t.call('GET', '/api/auth/session', undefined, admin)).json().user;
    for (const body of [{ disabled: true }, { role: 'user' }]) {
      const res = await t.call('PATCH', `/api/users/${me.id}`, body, admin);
      expect(res.statusCode).toBe(403);
    }
  });

  it('AC4: updating an unknown or malformed id answers 404, an empty update 400', async () => {
    const { t, admin, user } = await withUser();
    const missing = '00000000-0000-4000-8000-000000000000';
    expect(
      (await t.call('PATCH', `/api/users/${missing}`, { disabled: true }, admin)).statusCode,
    ).toBe(404);
    expect((await t.call('PATCH', '/api/users/nope', { disabled: true }, admin)).statusCode).toBe(
      404,
    );
    expect((await t.call('PATCH', `/api/users/${user.id}`, {}, admin)).statusCode).toBe(400);
  });
});

import { apiErrorSchema, userSchema } from '@factory-sim/schema';
import { describe, expect, it } from 'vitest';
import { PASSWORD, testApp } from '../test-app';

const NEW_PASSWORD = 'a brand new passphrase';

async function withUser() {
  const t = await testApp();
  const { cookie: admin } = await t.setup();
  const created = await t.call(
    'POST',
    '/api/users',
    { email: 'eng@plant.test', password: PASSWORD },
    admin,
  );
  const user = userSchema.parse(created.json());
  const { cookie } = await t.login('eng@plant.test');
  const { cookie: other } = await t.login('eng@plant.test');
  return { t, admin, user, cookie: cookie!, other: other! };
}

const sessionStatus = async (t: Awaited<ReturnType<typeof testApp>>, cookie: string) =>
  (await t.call('GET', '/api/auth/session', undefined, cookie)).statusCode;

describe('change password', () => {
  it('AC1: a signed-in user changes their password with the current one', async () => {
    const { t, cookie } = await withUser();
    const res = await t.call(
      'POST',
      '/api/auth/password',
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      cookie,
    );
    expect(res.statusCode).toBe(204);
    expect((await t.login('eng@plant.test', NEW_PASSWORD)).res.statusCode).toBe(200);
    expect((await t.login('eng@plant.test', PASSWORD)).res.statusCode).toBe(401);
  });

  it('AC1: a wrong current password answers 401 and changes nothing', async () => {
    const { t, cookie } = await withUser();
    const res = await t.call(
      'POST',
      '/api/auth/password',
      { currentPassword: 'not the password', newPassword: NEW_PASSWORD },
      cookie,
    );
    expect(res.statusCode).toBe(401);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('unauthorized');
    expect((await t.login('eng@plant.test', PASSWORD)).res.statusCode).toBe(200);
  });

  it('AC1: a new password below the policy answers 400', async () => {
    const { t, cookie } = await withUser();
    const res = await t.call(
      'POST',
      '/api/auth/password',
      { currentPassword: PASSWORD, newPassword: 'short' },
      cookie,
    );
    expect(res.statusCode).toBe(400);
  });

  it('AC1: requires a session', async () => {
    const t = await testApp();
    const res = await t.call('POST', '/api/auth/password', {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.statusCode).toBe(401);
  });

  it('AC1: wrong current passwords are throttled like sign-in', async () => {
    const { t, cookie } = await withUser();
    for (let i = 0; i < 5; i++) {
      await t.call(
        'POST',
        '/api/auth/password',
        { currentPassword: 'wrong wrong wrong', newPassword: NEW_PASSWORD },
        cookie,
      );
    }
    const res = await t.call(
      'POST',
      '/api/auth/password',
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      cookie,
    );
    expect(res.statusCode).toBe(429);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('rate_limited');
  });

  it('AC3: changing your password ends your other sessions but keeps the current one', async () => {
    const { t, cookie, other } = await withUser();
    expect(await sessionStatus(t, other)).toBe(200);
    await t.call(
      'POST',
      '/api/auth/password',
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      cookie,
    );
    expect(await sessionStatus(t, cookie)).toBe(200);
    expect(await sessionStatus(t, other)).toBe(401);
  });
});

describe('admin password reset', () => {
  it('AC2: an admin sets a new password for another user', async () => {
    const { t, admin, user } = await withUser();
    const res = await t.call(
      'PUT',
      `/api/users/${user.id}/password`,
      { newPassword: NEW_PASSWORD },
      admin,
    );
    expect(res.statusCode).toBe(204);
    expect((await t.login('eng@plant.test', NEW_PASSWORD)).res.statusCode).toBe(200);
    expect((await t.login('eng@plant.test', PASSWORD)).res.statusCode).toBe(401);
  });

  it('AC2: a non-admin gets 403', async () => {
    const { t, user, cookie } = await withUser();
    const res = await t.call(
      'PUT',
      `/api/users/${user.id}/password`,
      { newPassword: NEW_PASSWORD },
      cookie,
    );
    expect(res.statusCode).toBe(403);
  });

  it('AC2: an admin resetting their own account gets 403', async () => {
    const { t, admin } = await withUser();
    const me = userSchema.parse(
      (await t.call('GET', '/api/auth/session', undefined, admin)).json().user,
    );
    const res = await t.call(
      'PUT',
      `/api/users/${me.id}/password`,
      { newPassword: NEW_PASSWORD },
      admin,
    );
    expect(res.statusCode).toBe(403);
  });

  it('AC2: unknown or malformed ids answer 404; a weak password answers 400', async () => {
    const { t, admin, user } = await withUser();
    const unknown = await t.call(
      'PUT',
      '/api/users/00000000-0000-4000-8000-000000000000/password',
      { newPassword: NEW_PASSWORD },
      admin,
    );
    expect(unknown.statusCode).toBe(404);
    const bad = await t.call(
      'PUT',
      '/api/users/nope/password',
      { newPassword: NEW_PASSWORD },
      admin,
    );
    expect(bad.statusCode).toBe(404);
    const weak = await t.call(
      'PUT',
      `/api/users/${user.id}/password`,
      { newPassword: 'short' },
      admin,
    );
    expect(weak.statusCode).toBe(400);
  });

  it('AC3: a reset ends all of the user’s sessions', async () => {
    const { t, admin, user, cookie, other } = await withUser();
    await t.call('PUT', `/api/users/${user.id}/password`, { newPassword: NEW_PASSWORD }, admin);
    expect(await sessionStatus(t, cookie)).toBe(401);
    expect(await sessionStatus(t, other)).toBe(401);
    expect(await sessionStatus(t, admin)).toBe(200);
  });
});

describe('media types', () => {
  it('non-JSON bodies answer 415 unsupported_media_type', async () => {
    const t = await testApp();
    for (const type of ['application/x-www-form-urlencoded', 'text/plain', 'multipart/form-data']) {
      const res = await t.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': type },
        payload: 'email=a',
      });
      expect(res.statusCode).toBe(415);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe('unsupported_media_type');
    }
  });
});

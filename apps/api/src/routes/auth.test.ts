import { apiErrorSchema, sessionResponseSchema } from '@factory-sim/schema';
import { describe, expect, it } from 'vitest';
import { sessions, users } from '../db/schema';
import { PASSWORD, testApp } from '../test-app';

const HOUR = 3_600_000;

describe('first-admin setup', () => {
  it('AC1: a fresh install reports that setup is needed', async () => {
    const t = await testApp();
    const res = await t.call('GET', '/api/auth/setup');
    expect(res.json()).toEqual({ needsSetup: true });
  });

  it('AC1: setup creates the admin, signs them in and ends the setup prompt', async () => {
    const t = await testApp();
    const { res, cookie } = await t.setup('Admin@Plant.test');
    expect(res.statusCode).toBe(200);
    const body = sessionResponseSchema.parse(res.json());
    expect(body.user).toMatchObject({ email: 'admin@plant.test', role: 'admin', disabled: false });
    expect((await t.call('GET', '/api/auth/session', undefined, cookie)).statusCode).toBe(200);
    expect((await t.call('GET', '/api/auth/setup')).json()).toEqual({ needsSetup: false });
  });

  it('AC1: setup after an admin exists answers 409 conflict', async () => {
    const t = await testApp();
    await t.setup();
    const again = await t.call('POST', '/api/auth/setup', {
      email: 'other@plant.test',
      password: PASSWORD,
    });
    expect(again.statusCode).toBe(409);
    expect(apiErrorSchema.parse(again.json()).error.code).toBe('conflict');
  });

  it('AC1: concurrent setups create exactly one admin', async () => {
    const t = await testApp();
    const results = await Promise.all(
      ['a@plant.test', 'b@plant.test', 'c@plant.test'].map((email) =>
        t.call('POST', '/api/auth/setup', { email, password: PASSWORD }),
      ),
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409, 409]);
    expect(await t.db.select().from(users)).toHaveLength(1);
  });

  it('AC1: setup rejects a password shorter than 12 characters', async () => {
    const t = await testApp();
    const res = await t.call('POST', '/api/auth/setup', {
      email: 'a@plant.test',
      password: 'short',
    });
    expect(res.statusCode).toBe(400);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('validation');
    expect(await t.db.select().from(users)).toHaveLength(0);
  });
});

describe('sign in', () => {
  it('AC2: signs in with email (any case) and password; cookie is httpOnly and SameSite=Lax', async () => {
    const t = await testApp();
    await t.setup();
    const { res } = await t.login('ADMIN@plant.test');
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === 'fs_session')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
    expect(cookie.secure).toBeFalsy();
  });

  it('AC2: passwords are stored as argon2id hashes, never plaintext', async () => {
    const t = await testApp();
    await t.setup();
    const [row] = await t.db.select().from(users);
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row?.passwordHash).not.toContain(PASSWORD);
  });

  it('AC2: the database stores a hash of the session id, not the cookie value', async () => {
    const t = await testApp();
    const { cookie } = await t.setup();
    const [row] = await t.db.select().from(sessions);
    expect(cookie.split('=')[1]!.length).toBeGreaterThanOrEqual(43); // >= 256 bits base64url
    expect(cookie).not.toContain(row!.idHash);
    expect(row!.idHash).not.toBe(cookie.split('=')[1]);
  });

  it('AC2: every login issues a new session id', async () => {
    const t = await testApp();
    const { cookie: first } = await t.setup();
    const { cookie: second } = await t.login('admin@plant.test');
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
  });

  it('AC2: wrong password, unknown email and disabled user get the identical 401', async () => {
    const t = await testApp();
    const { cookie } = await t.setup();
    await t.call('POST', '/api/users', { email: 'u@plant.test', password: PASSWORD }, cookie);
    const [u] = (await t.call('GET', '/api/users', undefined, cookie))
      .json()
      .users.filter((x: { email: string }) => x.email === 'u@plant.test');
    await t.call('PATCH', `/api/users/${u.id}`, { disabled: true }, cookie);

    const wrong = await t.login('admin@plant.test', 'wrong password!!');
    const unknown = await t.login('nobody@plant.test');
    const disabled = await t.login('u@plant.test');
    for (const r of [wrong, unknown, disabled]) {
      expect(r.res.statusCode).toBe(401);
      expect(r.cookie).toBeUndefined();
    }
    expect(unknown.res.json()).toEqual(wrong.res.json());
    expect(disabled.res.json()).toEqual(wrong.res.json());
  });

  it('AC2: repeated failures for one email and IP are throttled with 429 and Retry-After', async () => {
    const t = await testApp();
    await t.setup();
    for (let i = 0; i < 5; i++) {
      expect((await t.login('admin@plant.test', 'wrong password!!')).res.statusCode).toBe(401);
    }
    const blocked = await t.login('admin@plant.test', PASSWORD); // even the right password
    expect(blocked.res.statusCode).toBe(429);
    expect(apiErrorSchema.parse(blocked.res.json()).error.code).toBe('rate_limited');
    expect(Number(blocked.res.headers['retry-after'])).toBeGreaterThan(0);
    // another email is unaffected
    expect((await t.login('someone@plant.test')).res.statusCode).toBe(401);
    // after the backoff passes the account works again
    t.advance(5_000);
    expect((await t.login('admin@plant.test')).res.statusCode).toBe(200);
  });

  it('AC2: mutating routes accept only application/json', async () => {
    const t = await testApp();
    for (const type of ['application/x-www-form-urlencoded', 'text/plain', 'multipart/form-data']) {
      const res = await t.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': type },
        payload: 'email=admin%40plant.test&password=x',
      });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.statusCode).toBeLessThan(500);
    }
  });

  it('AC2: malformed login bodies answer 400 validation', async () => {
    const t = await testApp();
    const res = await t.call('POST', '/api/auth/login', { email: 'not-an-email', password: '' });
    expect(res.statusCode).toBe(400);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe('validation');
  });
});

describe('sessions', () => {
  it('AC3: requests without a session answer 401', async () => {
    const t = await testApp();
    expect((await t.call('GET', '/api/auth/session')).statusCode).toBe(401);
    expect((await t.call('GET', '/api/users')).statusCode).toBe(401);
  });

  it('AC3: a session expires after the idle limit', async () => {
    const t = await testApp({ idleHours: 8 });
    const { cookie } = await t.setup();
    t.advance(8 * HOUR + 1000);
    expect((await t.call('GET', '/api/auth/session', undefined, cookie)).statusCode).toBe(401);
  });

  it('AC3: activity keeps a session alive past the idle limit measured from creation', async () => {
    const t = await testApp({ idleHours: 8 });
    const { cookie } = await t.setup();
    for (let i = 0; i < 3; i++) {
      t.advance(5 * HOUR);
      expect((await t.call('GET', '/api/auth/session', undefined, cookie)).statusCode).toBe(200);
    }
  });

  it('AC3: a session expires at the absolute limit even if active', async () => {
    const t = await testApp({ idleHours: 8, maxDays: 1 });
    const { cookie } = await t.setup();
    for (let i = 0; i < 4; i++) {
      t.advance(7 * HOUR);
      await t.call('GET', '/api/auth/session', undefined, cookie);
    }
    t.advance(HOUR); // now > 24h after creation
    expect((await t.call('GET', '/api/auth/session', undefined, cookie)).statusCode).toBe(401);
  });

  it('AC3: signing out ends the session and clears the cookie', async () => {
    const t = await testApp();
    const { cookie } = await t.setup();
    const out = await t.call('POST', '/api/auth/logout', undefined, cookie);
    expect(out.statusCode).toBe(204);
    expect(out.cookies.find((c) => c.name === 'fs_session')?.value).toBe('');
    expect((await t.call('GET', '/api/auth/session', undefined, cookie)).statusCode).toBe(401);
    expect(await t.db.select().from(sessions)).toHaveLength(0);
  });

  it('AC3: signing out without a session is harmless', async () => {
    const t = await testApp();
    expect((await t.call('POST', '/api/auth/logout')).statusCode).toBe(204);
  });
});

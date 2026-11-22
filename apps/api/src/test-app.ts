import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER } from './db/migrate';
import { buildServer } from './server';

export const PASSWORD = 'correct horse battery';

/** Real Postgres (PGlite) plus a movable clock; shared by the route tests. */
export async function testApp(overrides: { idleHours?: number; maxDays?: number } = {}) {
  const db = drizzle(new PGlite());
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  let time = new Date('2026-01-01T09:00:00Z').getTime();
  const app = buildServer({
    db,
    config: {
      sessionSecret: 'test-secret-value',
      sessionIdleHours: overrides.idleHours ?? 8,
      sessionMaxDays: overrides.maxDays ?? 7,
      cookieSecure: false,
    },
    now: () => new Date(time),
  });
  await app.ready();

  type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
  const call = (method: Method, url: string, body?: unknown, cookie?: string, ip?: string) =>
    app.inject({
      method,
      url,
      ...(body === undefined ? {} : { payload: body as object }),
      ...(ip ? { remoteAddress: ip } : {}),
      headers: cookie ? { cookie } : {},
    });
  /** `name=value` of the session Set-Cookie, ready to send back. */
  const cookieOf = (res: { cookies: { name: string; value: string }[] }) => {
    const c = res.cookies.find((x) => x.name === 'fs_session');
    return c ? `fs_session=${c.value}` : undefined;
  };
  const setup = async (email = 'admin@plant.test') => {
    const res = await call('POST', '/api/auth/setup', { email, password: PASSWORD });
    return { res, cookie: cookieOf(res)! };
  };
  const login = async (email: string, password = PASSWORD) => {
    const res = await call('POST', '/api/auth/login', { email, password });
    return { res, cookie: cookieOf(res) };
  };
  return {
    app,
    db,
    call,
    cookieOf,
    setup,
    login,
    advance: (ms: number) => (time += ms),
  };
}

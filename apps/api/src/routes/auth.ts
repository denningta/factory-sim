import {
  loginRequestSchema,
  setupRequestSchema,
  userIdSchema,
  type SessionResponse,
  type SetupStatusResponse,
  type User,
} from '@factory-sim/schema';
import { eq, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { dummyHash, hashPassword, verifyPassword } from '../auth/passwords';
import { createSession, deleteSession, purgeExpired, type UserRow } from '../auth/sessions';
import {
  clearSessionCookie,
  requireUser,
  sessionCookie,
  setSessionCookie,
  type AppContext,
} from '../context';
import { instanceSetup, users } from '../db/schema';
import { HttpError, parseWith } from '../http-error';

export function toUser(row: UserRow): User {
  return {
    id: userIdSchema.parse(row.id),
    email: row.email,
    role: row.role,
    disabled: row.disabled,
    createdAt: row.createdAt.toISOString(),
  };
}

// One message for every failure so responses never reveal which emails have accounts.
const BAD_CREDENTIALS = 'Invalid email or password';

export const authRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (app, { ctx }) => {
  const hasAdmin = async () => {
    const [row] = await ctx.db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'admin'));
    return (row?.n ?? 0) > 0;
  };

  app.get('/api/auth/setup', async (): Promise<SetupStatusResponse> => ({
    needsSetup: !(await hasAdmin()),
  }));

  app.post('/api/auth/setup', async (request, reply): Promise<SessionResponse> => {
    const { email, password } = parseWith(setupRequestSchema, request.body);
    const passwordHash = await hashPassword(password);
    // The singleton marker row makes "first admin" atomic: a concurrent second setup hits
    // the primary key conflict and rolls back, so two admins can't both be created.
    const row = await ctx.db.transaction(async (tx) => {
      const marker = await tx
        .insert(instanceSetup)
        .values({ id: true })
        .onConflictDoNothing()
        .returning();
      if (marker.length === 0) return undefined;
      const [created] = await tx
        .insert(users)
        .values({ email, passwordHash, role: 'admin' })
        .returning();
      return created;
    });
    if (!row) throw new HttpError('conflict', 'Setup is already complete');
    setSessionCookie(ctx, reply, await createSession(ctx.db, ctx.policy, row.id, ctx.now()));
    return { user: toUser(row) };
  });

  app.post('/api/auth/login', async (request, reply): Promise<SessionResponse> => {
    const { email, password } = parseWith(loginRequestSchema, request.body);
    const key = `${email}|${request.ip}`;
    // Reserve the attempt before the slow verify so a concurrent burst can't all pass the check.
    const wait = ctx.throttle.attempt(key);
    if (wait > 0) {
      throw new HttpError('rate_limited', 'Too many failed sign-ins; try again later', {
        'retry-after': String(wait),
      });
    }
    const [user] = await ctx.db.select().from(users).where(eq(users.email, email));
    // Always run one argon2 verification, against a dummy hash when there is no account,
    // so timing doesn't distinguish unknown emails from wrong passwords.
    const matches = await verifyPassword(user?.passwordHash ?? (await dummyHash()), password);
    if (!user || !matches || user.disabled) {
      throw new HttpError('unauthorized', BAD_CREDENTIALS);
    }
    ctx.throttle.succeed(key);
    const now = ctx.now();
    // Signing in again replaces the session this browser presented, rather than leaving it valid.
    const presented = sessionCookie(request);
    if (presented) await deleteSession(ctx.db, ctx.policy, presented);
    await purgeExpired(ctx.db, ctx.policy, now);
    // A new id on every login prevents session fixation.
    setSessionCookie(ctx, reply, await createSession(ctx.db, ctx.policy, user.id, now));
    return { user: toUser(user) };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const id = sessionCookie(request);
    if (id) await deleteSession(ctx.db, ctx.policy, id);
    clearSessionCookie(ctx, reply);
    return reply.code(204).send();
  });

  app.get('/api/auth/session', { preHandler: requireUser(ctx) }, (request): SessionResponse => ({
    user: toUser(request.user!),
  }));
};

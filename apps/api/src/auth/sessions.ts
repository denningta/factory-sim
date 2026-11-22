import { createHmac, randomBytes } from 'node:crypto';
import { eq, lt, or } from 'drizzle-orm';
import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';

export interface SessionPolicy {
  secret: string;
  idleMs: number;
  maxMs: number;
}

export type UserRow = typeof users.$inferSelect;

const hashId = (secret: string, id: string) =>
  createHmac('sha256', secret).update(id).digest('hex');

/** Issues a fresh id (256 bits, CSPRNG) and stores only its HMAC. Returns the cookie value. */
export async function createSession(
  db: Db,
  policy: SessionPolicy,
  userId: string,
  now: Date,
): Promise<string> {
  const id = randomBytes(32).toString('base64url');
  await db
    .insert(sessions)
    .values({ idHash: hashId(policy.secret, id), userId, createdAt: now, lastSeenAt: now });
  return id;
}

/**
 * Resolves a cookie value to its user, or undefined when unknown, expired or the user is
 * disabled. Role and disabled flag come from the users table on every call so changes apply
 * at once. A valid lookup slides the idle window.
 */
export async function resolveSession(
  db: Db,
  policy: SessionPolicy,
  id: string,
  now: Date,
): Promise<UserRow | undefined> {
  const idHash = hashId(policy.secret, id);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.idHash, idHash));
  if (!row) return undefined;
  const idleFor = now.getTime() - row.session.lastSeenAt.getTime();
  const age = now.getTime() - row.session.createdAt.getTime();
  if (idleFor > policy.idleMs || age > policy.maxMs || row.user.disabled) {
    await db.delete(sessions).where(eq(sessions.idHash, idHash));
    return undefined;
  }
  await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.idHash, idHash));
  return row.user;
}

export async function deleteSession(db: Db, policy: SessionPolicy, id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.idHash, hashId(policy.secret, id)));
}

export async function deleteUserSessions(db: Db, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Housekeeping: drops sessions that can no longer resolve. Called on login. */
export async function purgeExpired(db: Db, policy: SessionPolicy, now: Date): Promise<void> {
  const idleCutoff = new Date(now.getTime() - policy.idleMs);
  const maxCutoff = new Date(now.getTime() - policy.maxMs);
  await db
    .delete(sessions)
    .where(or(lt(sessions.lastSeenAt, idleCutoff), lt(sessions.createdAt, maxCutoff)));
}

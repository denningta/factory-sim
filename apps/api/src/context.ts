import type { FastifyReply, FastifyRequest } from 'fastify';
import type { LoginThrottle } from './auth/rate-limit';
import { resolveSession, type SessionPolicy, type UserRow } from './auth/sessions';
import type { Db } from './db/client';
import { HttpError } from './http-error';

export const SESSION_COOKIE = 'fs_session';

export interface AppContext {
  db: Db;
  policy: SessionPolicy;
  cookieSecure: boolean;
  now: () => Date;
  throttle: LoginThrottle;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserRow;
  }
}

/** Cookie value of the current request, if any. */
export function sessionCookie(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE] || undefined;
}

export function setSessionCookie(ctx: AppContext, reply: FastifyReply, id: string): void {
  reply.setCookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: ctx.cookieSecure,
    path: '/',
    // The browser forgets the cookie at the absolute limit; idle expiry is enforced server-side.
    maxAge: Math.floor(ctx.policy.maxMs / 1000),
  });
}

export function clearSessionCookie(ctx: AppContext, reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: ctx.cookieSecure,
    path: '/',
  });
}

/** Route guard: requires a valid session and (optionally) the admin role. */
export function requireUser(ctx: AppContext, role?: 'admin') {
  return async (request: FastifyRequest): Promise<void> => {
    const id = sessionCookie(request);
    const user = id ? await resolveSession(ctx.db, ctx.policy, id, ctx.now()) : undefined;
    if (!user) throw new HttpError('unauthorized', 'Sign in required');
    if (role && user.role !== role) throw new HttpError('forbidden', 'Admin access required');
    request.user = user;
  };
}

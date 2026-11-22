import fastifyCookie from '@fastify/cookie';
import Fastify from 'fastify';
import type { AppContext } from './context';
import { createLoginThrottle, type LoginThrottle } from './auth/rate-limit';
import type { Db } from './db/client';
import type { AppEnv } from './env';
import { HttpError } from './http-error';
import { openApiDocument } from './openapi';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';

export interface ServerDeps {
  db: Db;
  config: Pick<AppEnv, 'sessionSecret' | 'sessionIdleHours' | 'sessionMaxDays' | 'cookieSecure'>;
  /** Injected so tests can move time without sleeping. */
  now?: () => Date;
  throttle?: LoginThrottle;
}

export function buildServer(deps: ServerDeps) {
  const now = deps.now ?? (() => new Date());
  const ctx: AppContext = {
    db: deps.db,
    policy: {
      secret: deps.config.sessionSecret,
      idleMs: deps.config.sessionIdleHours * 3_600_000,
      maxMs: deps.config.sessionMaxDays * 86_400_000,
    },
    cookieSecure: deps.config.cookieSecure,
    now,
    throttle: deps.throttle ?? createLoginThrottle(() => now().getTime()),
  };

  const app = Fastify({ logger: false });
  void app.register(fastifyCookie);

  // JSON only on mutating routes (CSRF defense with SameSite): drop Fastify's text/plain
  // parser and register no form or multipart parsers, so other types answer 415.
  app.removeContentTypeParser('text/plain');

  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.status).headers(error.headers).send(error.body());
    }
    const status = error.statusCode ?? 500;
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply
        .code(413)
        .send(new HttpError('payload_too_large', 'Request body too large').body());
    }
    if (status === 415 || status === 400) {
      return reply.code(status).send(new HttpError('validation', error.message).body());
    }
    // Details stay in the log; clients get a generic message.
    console.error(`${request.method} ${request.url}`, error);
    return reply.code(500).send(new HttpError('internal', 'Internal server error').body());
  });
  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send(new HttpError('not_found', 'Not found').body()),
  );

  // Liveness probe used by the container healthcheck.
  app.get('/health', () => ({ status: 'ok' }));
  app.get('/api/openapi.json', () => openApiDocument());

  void app.register(async (api) => {
    await api.register(authRoutes, { ctx });
    await api.register(userRoutes, { ctx });
  });
  return app;
}

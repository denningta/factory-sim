import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyReply } from 'fastify';
import type { AppContext } from './context';
import { dummyHash } from './auth/passwords';
import { createLoginThrottle, type LoginThrottle } from './auth/rate-limit';
import type { Db } from './db/client';
import type { AppEnv } from './env';
import { HttpError, toErrorResponse } from './http-error';
import { openApiDocument } from './openapi';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';

export interface ServerDeps {
  db: Db;
  config: Pick<
    AppEnv,
    'sessionSecret' | 'sessionIdleHours' | 'sessionMaxDays' | 'cookieSecure' | 'trustProxy'
  >;
  /** Injected so tests can move time without sleeping. */
  now?: () => Date;
  throttle?: LoginThrottle;
  /** Directory holding the built web app; when set, the API also serves it. */
  webRoot?: string;
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

  // Only the listed proxies may set X-Forwarded-For; otherwise any client could forge its IP and
  // dodge the sign-in throttle. An empty list trusts nobody. See docs/deploy.md.
  const app = Fastify({
    logger: false,
    trustProxy: deps.config.trustProxy.length > 0 ? deps.config.trustProxy : false,
  });
  // Pay the argon2 cost of the dummy hash now, not on the first unknown-email sign-in.
  void dummyHash();
  void app.register(fastifyCookie);

  // JSON only on mutating routes (CSRF defense with SameSite): drop Fastify's text/plain
  // parser and register no form or multipart parsers, so other types answer 415.
  app.removeContentTypeParser('text/plain');

  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
    const { status, body } = toErrorResponse(error);
    if (status >= 500) {
      // Details stay in the log; clients get a generic message.
      console.error(`${request.method} ${request.url}`, error);
    }
    const headers = error instanceof HttpError ? error.headers : {};
    return reply.code(status).headers(headers).send(body);
  });
  const notFound = (reply: FastifyReply) =>
    reply.code(404).send(new HttpError('not_found', 'Not found').body());
  const webRoot = deps.webRoot;
  if (webRoot) {
    void app.register(fastifyStatic, { root: webRoot });
  }
  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split('?')[0] ?? '';
    // Only extension-less GET navigations fall back to the SPA. API paths and file-like paths
    // stay 404s so a bad deploy shows up as a 404 rather than HTML where JS was expected.
    const isRoute = path !== '/api' && !path.startsWith('/api/') && !/\.[^/]+$/.test(path);
    if (webRoot && req.method === 'GET' && isRoute) return reply.sendFile('index.html');
    return notFound(reply);
  });

  // Liveness probe used by the container healthcheck.
  app.get('/health', () => ({ status: 'ok' }));
  app.get('/api/openapi.json', () => openApiDocument());

  void app.register(async (api) => {
    await api.register(authRoutes, { ctx });
    await api.register(userRoutes, { ctx });
  });
  return app;
}

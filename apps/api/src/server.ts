import Fastify from 'fastify';

export function buildServer() {
  const app = Fastify({ logger: false });
  // Liveness probe used by the container healthcheck.
  app.get('/health', () => ({ status: 'ok' }));
  return app;
}

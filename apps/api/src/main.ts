import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { migrateDatabase } from './db/migrate';
import { loadEnv, type AppEnv } from './env';
import { buildServer } from './server';

// Fail before touching the database if the deploy is misconfigured.
let config: AppEnv;
try {
  config = loadEnv(process.env);
} catch (err) {
  // Message only: a stack trace would bury the actionable line for an admin reading logs.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
const { port, databaseUrl } = config;

// Migrate before listening so the healthcheck only passes once the schema is current.
await migrateDatabase(databaseUrl);

const pool = new pg.Pool({ connectionString: databaseUrl });
// The image builds the web app next to the API; a plain dev checkout may not have, so serve it only if present.
const dist = fileURLToPath(new URL('../../web/dist', import.meta.url));
const webRoot = existsSync(dist) ? dist : undefined;
await buildServer({ db: drizzle(pool), config, ...(webRoot ? { webRoot } : {}) }).listen({
  port,
  host: '0.0.0.0',
});
console.log(`api listening on :${port}`);

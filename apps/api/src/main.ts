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

await buildServer().listen({ port, host: '0.0.0.0' });
console.log(`api listening on :${port}`);

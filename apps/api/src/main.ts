import { migrateDatabase } from './db/migrate';
import { loadEnv } from './env';
import { buildServer } from './server';

// Fail before touching the database if the deploy is misconfigured.
const { port, databaseUrl } = loadEnv(process.env);

// Migrate before listening so the healthcheck only passes once the schema is current.
await migrateDatabase(databaseUrl);

await buildServer().listen({ port, host: '0.0.0.0' });
console.log(`api listening on :${port}`);

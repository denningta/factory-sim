import { migrateDatabase } from './db/migrate';
import { buildServer } from './server';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

// Migrate before listening so the healthcheck only passes once the schema is current.
await migrateDatabase(databaseUrl);

const port = Number(process.env.PORT ?? 8080);
await buildServer().listen({ port, host: '0.0.0.0' });
console.log(`api listening on :${port}`);

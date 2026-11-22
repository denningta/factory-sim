import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

/**
 * Applies pending migrations. Drizzle records applied ones in its journal table, so
 * calling this on every startup (or twice in a row) only runs what is new.
 */
export async function migrateDatabase(databaseUrl: string): Promise<void> {
  // Postgres may still be starting even when compose says it is healthy (e.g. after a restart).
  await retry(async () => {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    try {
      await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
    } finally {
      await pool.end();
    }
  });
}

export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  log?: (message: string) => void;
}

/** Runs `op`, retrying on any error (default ~30 s at 1 s backoff); rethrows the last error. */
export async function retry<T>(op: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 30, delayMs = 1000, log = console.log } = options;
  for (let attempt = 1; ; attempt++) {
    try {
      return await op();
    } catch (error) {
      if (attempt >= attempts) throw error;
      log('waiting for database');
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

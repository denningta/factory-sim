import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

/** Driver-agnostic handle: node-postgres in production, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT>;

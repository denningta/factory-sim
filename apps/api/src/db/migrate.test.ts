import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createProject } from '@factory-sim/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER } from './migrate';
import { projects } from './schema';

// PGlite is real Postgres compiled to WASM, so the same SQL files run as in the container.
async function freshDb() {
  return drizzle(new PGlite());
}

describe('migrations', () => {
  it('AC3: migrations create the projects table on an empty database', async () => {
    const db = await freshDb();
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    await expect(db.select().from(projects)).resolves.toEqual([]);
  });

  it('AC3: running migrations twice is safe and keeps existing rows', async () => {
    const db = await freshDb();
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    const [row] = await db
      .insert(projects)
      .values({ name: 'Line 1', document: createProject() })
      .returning();
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    const rows = await db.select().from(projects).where(eq(projects.id, row!.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.document).toEqual(createProject());
  });
});

describe('persistence', () => {
  it('AC2: a project survives closing and reopening the database', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'pl2-pgdata-'));
    try {
      const first = new PGlite(dataDir);
      const db1 = drizzle(first);
      await migrate(db1, { migrationsFolder: MIGRATIONS_FOLDER });
      const [row] = await db1
        .insert(projects)
        .values({ name: 'Line 1', document: createProject() })
        .returning();
      await first.close();

      const second = new PGlite(dataDir);
      const db2 = drizzle(second);
      await migrate(db2, { migrationsFolder: MIGRATIONS_FOLDER });
      const rows = await db2.select().from(projects).where(eq(projects.id, row!.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe('Line 1');
      expect(rows[0]?.document).toEqual(createProject());
      await second.close();
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

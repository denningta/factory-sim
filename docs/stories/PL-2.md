---
id: PL-2
epic: Platform
points: 3
priority: Must
sprint: 1
depends_on: [PL-1]
builder_model: sonnet
owner: builder
issue: 18
---

# PL-2: Data to survive upgrades

**Story:** As an IT admin, I want data to survive upgrades so that no project is ever lost when we update the app.

## Acceptance criteria

- [x] Postgres data lives in a named volume
- [x] Recreating or upgrading containers keeps all projects
- [x] Schema migrations run automatically on startup and are safe to run twice

## Notes

- Added a minimal Drizzle `projects` table (`apps/api/src/db/schema.ts`) and migration `apps/api/drizzle/0000_init.sql`; `apps/api/src/main.ts` runs `migrateDatabase` before listening. Drizzle's journal table makes re-runs a no-op.
- Verified in Docker: `down` + `up` and `up --force-recreate` kept a row; the journal had one entry after multiple startups.

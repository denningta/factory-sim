---
id: SC-1
epic: Scenarios & projects
points: 5
priority: Must
sprint: 2
depends_on: [PL-2, PL-3, PL-6]
builder_model: sonnet
owner: builder
issue: 27
---

# SC-1: Save and open projects on the server

**Story:** As a manufacturing engineer, I want to save and open projects on the server so that my work is safe and I can pick up where I left off.

## Acceptance criteria

- [ ] Create, rename, open and delete projects
- [ ] Changes autosave within 5 seconds
- [ ] Project list shows name and last modified date

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Contract (lead):** shapes and routes are in `packages/schema/src/http.ts`. Reads go through `loadProject`, so the client always gets the current schema version, and writes go through `validateProject` (via `projectDetailSchema` and `updateProjectRequestSchema`).
- **Privacy (ADR-0011):** projects are private to their creator. Another user's project id answers 404. This needs an `owner_id` column, added by a migration in this story.
- **Autosave:** `PATCH` with `baseRevision`. Update `WHERE id = $1 AND owner_id = $2 AND revision = $base`, setting `revision = revision + 1, updated_at = now()`. Zero rows means 404 if the project is missing, else 409 `conflict`. The web app then tells the user instead of overwriting. The migration adds `revision integer not null default 0`.
- **Stale client after an upgrade:** if a save fails because its `schemaVersion` is older than current, answer `validation` with "The app was updated. Reload to keep editing." Don't use a generic field list.
- **Body size:** Fastify's default `bodyLimit` (1 MiB) is fine for MVP layouts. Over it, answer 413 `payload_too_large`.
- **Depends on PL-6** for sessions and user ids.

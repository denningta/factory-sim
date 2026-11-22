---
id: PL-7
epic: Platform
points: 2
priority: Must
sprint: 1
depends_on: [PL-1, PL-2]
builder_model: sonnet
owner: builder
issue: 43
---

# PL-7: Harden the Docker deployment

**Story:** As an IT admin, I want the app to refuse unsafe or broken configuration and run without root, so that a misconfigured deploy fails loudly instead of running insecurely.

_Follow-up from the post-merge review of PL-1 (#41); the lead added it with product-owner approval._

## Acceptance criteria

- [ ] At startup, the environment is validated with zod, and the app refuses to start with a clear message when `PORT` is empty or invalid, `DATABASE_URL` is missing, or `SESSION_SECRET` is missing or still the `.env.example` placeholder
- [ ] The app container runs as a non-root user
- [ ] `docs/deploy.md`:
  - the health-check example uses the configured port
  - the backup command works on the host and writes to a file
  - it explains that the database password appears in both `POSTGRES_PASSWORD` and `DATABASE_URL` and must be changed in both, **or** the configuration derives one from the other

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- Env validation belongs in `apps/api` (startup config), not in `packages/schema`, which holds the project document only.
- CI's `compose smoke` job already sets a random `SESSION_SECRET`, so refusing the placeholder won't break CI. It must stay green.
- Nice to have, not required: a production build instead of tsx with dev dependencies, and a test that Postgres actually writes to the named volume.

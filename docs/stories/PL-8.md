---
id: PL-8
epic: Platform
points: 2
priority: Must
sprint: 2
depends_on: [PL-1]
builder_model: sonnet
owner: builder
issue: 58
---

# PL-8: Open the web app from the Docker Compose stack

**Story:** As an IT admin, I want the deployed stack to serve the web app so that engineers can open the simulator in a browser right after `docker compose up`.

_Added by the lead with product-owner approval (2026-11-22). The LE-1 review found that the deployed stack served only the API._

## Acceptance criteria

- [ ] After `docker compose up -d`, opening `http://localhost:${APP_PORT}/` shows the web app
- [ ] `/health` and every route under `/api` keep working; other unknown paths return the app's `index.html`, so client-side routes survive a reload
- [ ] The image contains the production build of the web app (no Vite dev server in the container)

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- One container, same origin: Fastify serves the built `apps/web/dist` (e.g. `@fastify/static`) next to the API, so session cookies (PL-6) need no CORS. The Dockerfile runs `vite build` for `apps/web`.
- Unknown `/api/*` paths must stay JSON 404s (the `ApiError` shape in `@factory-sim/schema`), never `index.html`.
- **Overlap:** PL-6 also changes `apps/api/src/server.ts`, so this story is scheduled after PL-6, not alongside it.
- CI: the `compose smoke` job (lead-owned) gets a check that `/` returns HTML. Tell the lead when the PR is up; don't edit `.github/`.

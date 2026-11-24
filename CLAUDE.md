# Factory Flow Simulator

Self-hosted web app for manufacturing engineers to lay out a to-scale, mixed-model production line in 3D, configure cycle times, buffers and technicians, run a discrete-event simulation and find the bottleneck. MVP = a 5-station, 2-product line: define → lay out → staff → simulate → analyze.

This repo is built by a team of Claude Code agents (lead, builders, reviewer) coordinated in herdr. The product owner (a human) sets priorities and makes product decisions; the lead merges reviewer-approved PRs under the merge rule in `.claude/agents/lead.md`. Runbook: `docs/agent-team.md`.

## Read first

- `docs/adr/`: accepted architecture decisions. **Read the relevant ADRs before changing architecture.** Never edit an Accepted ADR in a story branch; propose changes to the lead.
- `docs/stories/<ID>.md`: the story spec and acceptance criteria. GitHub Issues hold live status.
- `docs/definition-of-done.md`: what "done" means for every story.
- `docs/wireframes/`: screen layouts; the IDs printed on each screen map UI regions to stories.
- `docs/reference-model/`: the regression model the engine is validated against.

## Stack (one line per ADR)

| Area      | Choice                                                                                         | ADR  |
| --------- | ---------------------------------------------------------------------------------------------- | ---- |
| Repo      | TypeScript monorepo, pnpm workspaces                                                           | 0001 |
| Web       | React + Vite, React Three Fiber + drei, Zustand                                                | 0002 |
| API       | Node 22 + Fastify, REST, zod validation, OpenAPI generated                                     | 0003 |
| DB        | PostgreSQL 16 container; relational tables + JSONB project documents                           | 0004 |
| ORM       | Drizzle + drizzle-kit migrations, run idempotently at startup                                  | 0005 |
| Schema    | zod in packages/schema, `schemaVersion` + one upgrade fn per version; **SI units only** (m, s) | 0006 |
| Engine    | Own DES engine in packages/sim-engine; seeded PRNG; no DOM/Node deps                           | 0007 |
| Rendering | Engine emits timestamped state events; renderer interpolates on its own clock                  | 0008 |
| Domain    | Product → Routing (ordered steps → station); cycle time keyed by (product, station)            | 0009 |
| Equipment | Types are data: 5 base behaviors (workstation, buffer, conveyor, source, sink) + params        | 0010 |
| Auth      | Email/password, argon2id, httpOnly session cookies in Postgres                                 | 0011 |
| Tests     | Vitest unit, Playwright e2e, reference model in CI, engine coverage ≥ 90%                      | 0012 |
| Deploy    | docker-compose.yml: app + postgres, named volume, healthcheck, .env                            | 0013 |

## Layout

```
apps/web            React + R3F editor and simulation UI
apps/api            Fastify API, auth, Drizzle migrations
packages/schema     Versioned project document (zod)          ← lead owns
packages/sim-engine Discrete-event engine (browser + Node)    ← lead owns the public API
docs/               ADRs, stories, wireframes, reference model, planning
scripts/            team-up.sh (herdr), import-backlog.py, create-issues.sh, hooks/
.claude/            shared settings, slash commands, agent roles
```

Workspace packages are imported by name (`@factory-sim/schema`) via their public entry, never via `/src/...` paths.

## Commands

```bash
pnpm install                 # install (Node 22+, pnpm pinned in package.json)
pnpm check                   # lint + typecheck + test: run before every commit
pnpm lint | pnpm typecheck | pnpm test | pnpm test:coverage
pnpm --filter @factory-sim/sim-engine test   # one package
pnpm format                  # prettier
docker compose up -d         # full stack (once PL-1 lands); docker compose logs -f app
```

A hook runs prettier and the owning package's type check after every Edit/Write. Fix what it reports before moving on.

## Conventions

- TypeScript strict everywhere. No `any` without a comment explaining why.
- **Tests first**: write a failing test for each acceptance criterion, then implement. Name tests after the criterion.
- **Units**: store and compute in meters and seconds. ft/min are display-only conversions in apps/web. Never persist display units.
- **Validation**: one zod schema in packages/schema serves web and API. Don't duplicate shapes by hand.
- **Determinism**: the engine never calls `Math.random`, `Date.now` or timers. Use the seeded PRNG and sim clock. Same seed + model ⇒ identical results.
- **Boundaries** (lint-enforced): packages never import apps; sim-engine and schema import no Node, DOM, React or three; web reaches api over HTTP only.
- **React + 3D**: keep per-frame updates out of React state (refs, `useFrame`, instancing). Zustand for editor state.
- Small, focused modules; no speculative abstractions. Comments explain _why_, not _what_.
- Keep secrets out of code and git. `.env.example` documents variables; `.env` is never read or committed by agents.

## Ownership and scope (all agents)

- **Builders**: one story per worktree, branch `story/<ID>`. Change only what the story needs. If the story requires a change to `packages/schema`, the **public API** of `packages/sim-engine`, `docs/adr/`, CI or `.claude/`, **stop and report to the lead**. Don't work around it.
- **Lead**: owns ADRs, packages/schema, the sim-engine API, the backlog/issues and dispatch. Doesn't implement feature stories (except PL-3 and API definitions).
- **Reviewer**: read-only. Runs tests, comments on PRs, never edits or merges.
- **Nobody** pushes to `main`, force-pushes, or edits acceptance criteria. Only the lead merges PRs (squash; guarded by `scripts/hooks/guard-merge.sh` and the `scripts/bin/gh` wrapper); the product owner merges what the merge rule reserves for them.
- If acceptance criteria are ambiguous, write the question in the PR/issue and pick the simplest reading that satisfies them; don't invent scope.

## Git and PRs

- Branch `story/<ID>`, commits `<ID>: <imperative summary>` (e.g. `PL-1: add postgres healthcheck`).
- One PR per story, using `.github/pull_request_template.md`: `Closes #<issue>`, a table mapping **each acceptance criterion → the test/check that verifies it**, the DoD checklist, and screenshots for UI.
- CI (lint, typecheck, tests) must be green before requesting review.
- Before the **first** push, rebase on `origin/main`. After a branch is pushed, never rebase it: bring in main with `git merge origin/main`, so pushes stay fast-forward (force-push is denied). Resolve conflicts in your own branch only.

## Definition of Done (summary; full list in docs/definition-of-done.md)

Acceptance criteria verified by automated tests · lint/typecheck/tests green in CI · works in the Docker Compose build · reviewer approved · no new critical bugs · docs updated if behavior changed · merged (by the lead, or the product owner where reserved).

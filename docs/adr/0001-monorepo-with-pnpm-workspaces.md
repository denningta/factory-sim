# ADR-0001: Monorepo with pnpm workspaces

- **Status:** Accepted (signed off 2026-11-21)
- **Date:** 2026-11-21

## Context

Four parts (web, api, sim-engine, schema) must share types and the engine must run in browser and server.

## Decision

One TypeScript monorepo using pnpm workspaces: apps/web, apps/api, packages/sim-engine, packages/schema.

## Consequences

- Positive: Shared types, one CI, atomic changes across packages; agents see the whole system.
- Negative: Slightly more build tooling; package boundaries must be enforced by lint rules.

## Alternatives considered

Polyrepo (harder for agents to keep in sync); Nx/Turborepo (can be added later for caching).

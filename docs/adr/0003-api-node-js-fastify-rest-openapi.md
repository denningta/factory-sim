# ADR-0003: API: Node.js + Fastify, REST + OpenAPI

- **Status:** Accepted (signed off 2026-11-21)
- **Date:** 2026-11-21

## Context

The server stores projects, handles auth and later runs headless simulations with the same engine.

## Decision

Node.js 22 + Fastify; REST endpoints validated with zod schemas from packages/schema; OpenAPI generated from them.

## Consequences

- Positive: Same language as the engine, so headless runs reuse it directly; one source of truth for validation.
- Negative: Not ideal for very long CPU jobs; headless runs go to worker threads.

## Alternatives considered

Python/FastAPI (would need a second engine); GraphQL (unneeded complexity for this data shape).

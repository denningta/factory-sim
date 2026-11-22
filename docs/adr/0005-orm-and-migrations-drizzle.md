# ADR-0005: ORM and migrations: Drizzle

- **Status:** Accepted (signed off 2026-11-21)
- **Date:** 2026-11-21

## Context

Schema changes must apply automatically on upgrade (PL-2) without manual SQL.

## Decision

Drizzle ORM with drizzle-kit migrations, run automatically and idempotently at app startup.

## Consequences

- Positive: Typed queries, plain SQL migrations kept in git, light runtime.
- Negative: Younger than Prisma; complex queries may need raw SQL.

## Alternatives considered

Prisma (heavier runtime and engine binary); Knex (untyped).

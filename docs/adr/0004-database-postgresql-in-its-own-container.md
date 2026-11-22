# ADR-0004: Database: PostgreSQL in its own container

- **Status:** Accepted (decided 2026-11-21)
- **Date:** 2026-11-21

## Context

Need durable storage for users, projects, scenarios and run results, deployable with one command.

## Decision

PostgreSQL 16 in a separate container under Docker Compose. Relational tables for users, projects and runs; each layout/scenario stored as a JSONB document.

## Consequences

- Positive: Robust, supports JSON queries, scales to a hosted product later.
- Negative: A second container to operate and back up (pg_dump).

## Alternatives considered

SQLite in a single container (simpler, but single-writer and no path to hosting).

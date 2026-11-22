# ADR-0013: Deploy with Docker Compose

- **Status:** Accepted (decided 2026-11-21)
- **Date:** 2026-11-21

## Context

IT at each plant must deploy and upgrade with minimal effort.

## Decision

docker-compose.yml with app and postgres services, named volume for data, Postgres healthcheck gating app start, restart policies, .env for secrets.

## Consequences

- Positive: One command to deploy (docker compose up -d) and to upgrade (pull + up).
- Negative: Two containers; backups need a documented pg_dump step.

## Alternatives considered

Single container with SQLite (rejected with ADR-0004).

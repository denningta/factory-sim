---
id: PL-1
epic: Platform
points: 5
priority: Must
sprint: 1
depends_on: []
builder_model: sonnet
owner: builder
issue: 17
---

# PL-1: Deploy the whole app with one Docker Compose command

**Story:** As an IT admin, I want to deploy the whole app with one Docker Compose command so that setup takes minutes, not days.

## Acceptance criteria

- [x] Given a host with Docker, when I run docker compose up -d with the example .env, then the app and Postgres start and the app is reachable on the configured port
- [x] The app waits for the Postgres healthcheck before starting
- [x] Both containers restart automatically after a host reboot

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

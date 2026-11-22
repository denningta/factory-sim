---
id: PL-2
epic: Platform
points: 3
priority: Must
sprint: 1
depends_on: [PL-1]
builder_model: sonnet
issue:
---

# PL-2: Data to survive upgrades

**Story:** As an IT admin, I want data to survive upgrades so that no project is ever lost when we update the app.

## Acceptance criteria

- [ ] Postgres data lives in a named volume
- [ ] Recreating or upgrading containers keeps all projects
- [ ] Schema migrations run automatically on startup and are safe to run twice

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

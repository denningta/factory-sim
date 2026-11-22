---
id: PL-4
epic: Platform
points: 3
priority: Must
sprint: 1
depends_on: []
builder_model: sonnet
owner: builder
issue: 20
---

# PL-4: Automated build and test on every commit

**Story:** As a developer, I want automated build and test on every commit so that broken code is caught before it ships.

## Acceptance criteria

- [ ] Each push runs lint, type checks and unit tests
- [ ] A passing main branch builds the Docker images
- [ ] A failing check blocks merging

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

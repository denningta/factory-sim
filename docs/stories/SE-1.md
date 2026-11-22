---
id: SE-1
epic: Simulation engine
points: 8
priority: Must
sprint: 1
depends_on: []
builder_model: opus
issue:
---

# SE-1: A discrete-event simulation engine in a shared TypeScript package

**Story:** As a developer, I want a discrete-event simulation engine in a shared TypeScript package so that the same model runs in the browser and on the server with identical results.

## Acceptance criteria

- [ ] Event calendar, entities (parts), resources (stations, techs) and queues
- [ ] Runs with no 3D view attached
- [ ] Results match an M/M/1 queue's theoretical waiting time within 2% over a long run
- [ ] Unit-tested to 90%+ coverage

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

---
id: FL-2
epic: Flow & connections
points: 3
priority: Must
sprint: 3
depends_on: [FL-1]
builder_model: sonnet
owner: builder
issue: 9
---

# FL-2: Set buffer capacity between stations

**Story:** As a manufacturing engineer, I want to set buffer capacity between stations so that blocking and starving are modeled.

## Acceptance criteria

- [ ] Each connection and each buffer object has a capacity (0 = no buffer, unlimited allowed)
- [ ] A full buffer blocks the upstream station; an empty one starves the downstream station
- [ ] Behavior verified by a two-station test model

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Contract:** `connection.capacity` is `0` (no buffer: direct hand-off, upstream blocks) or a positive integer, or `null` for unlimited. Buffer objects' capacity is `params.capacity` (positive integer). **Product owner (2026-11-22): buffer objects always have a finite capacity the user sets** (WS-1 properties panel). Only connections may be unlimited.
- The two-station test model (AC3) runs on the SE-1 kernel (`Queue` with finite capacity gives blocking). Building it may need the line-model API, so ask the lead before adding to `packages/sim-engine`'s public API.

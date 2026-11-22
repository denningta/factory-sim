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

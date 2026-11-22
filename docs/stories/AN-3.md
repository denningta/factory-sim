---
id: AN-3
epic: Analytics & KPIs
points: 3
priority: Must
sprint: 6
depends_on: [AN-2, SE-3]
builder_model: sonnet
issue:
---

# AN-3: Stations colored by state and the bottleneck flagged

**Story:** As a manufacturing engineer, I want stations colored by state and the bottleneck flagged so that I can find the constraint at a glance.

## Acceptance criteria

- [ ] Live colors: working green, starved yellow, blocked red, idle gray
- [ ] The station with the highest working % (or longest uninterrupted active periods) is flagged as the bottleneck
- [ ] The flag updates during the run

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

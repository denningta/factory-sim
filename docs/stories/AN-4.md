---
id: AN-4
epic: Analytics & KPIs
points: 2
priority: Should
sprint: 7
depends_on: [AN-3]
builder_model: sonnet
owner: builder
issue: 132
---

# AN-4: Station colours correct when animation is turned back on

**Story:** As a manufacturing engineer, I want station colours to show the real state as soon as I turn animation back on.

## Acceptance criteria

- [ ] After Animate off → on mid-run, every station plate shows its current state immediately
- [ ] After Run to end → Reset → Animate on, stations show their t = 0 state

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ needs a lead-owned engine addition, `Run.stationStates()`, tracked with events off (like `wip()` and `techs()`). The lead lands it before dispatch. Seed the station status from it on re-enable.

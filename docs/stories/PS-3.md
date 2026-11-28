---
id: PS-3
epic: Parallel stations
points: 3
priority: Should
sprint: 10
depends_on: [PS-1, PS-2]
builder_model: sonnet
owner: builder
issue: 208
---

# PS-3: Bottleneck view groups parallel stations

**Story:** As a manufacturing engineer, I want parallel stations judged as one step so that two half-busy autoclaves don't hide a constraint.

## Acceptance criteria

- [ ] Results list a step with alternates as a group ("Cure ×2") with average utilization, plus each station on expand
- [ ] Bottleneck detection ranks groups, not single stations, for steps with alternates
- [ ] Station callouts in Simulate show each station's own status as today
- [ ] Screenshots in `docs/screenshots/PS-3/`

## Notes

- _Lead (2026-11-27):_ web-only grouping of per-station results (ADR-0018 §5).

---
id: TE-2
epic: Technicians
points: 5
priority: Must
sprint: 5
depends_on: [TE-1, SE-3]
builder_model: sonnet
owner: builder
issue: 34
---

# TE-2: Techs to walk between their stations in the 3D view

**Story:** As a manufacturing engineer, I want techs to walk between their stations in the 3D view so that walking waste shows up in the results.

## Acceptance criteria

- [ ] Techs move along straight-line paths between assigned stations at their walk speed
- [ ] Walk time counts toward tech utilization as walking, not working
- [ ] Techs show as simple 3D markers with their name

## Notes

- The engine already emits `techMoved` (straight line, distance / walkSpeed) and `techState`, and counts walking separately from working, so AC2 needed no engine change; the web adds `techTracks` (poses on the sim clock) and `TechLayer` (capsule + name sprite, orange while walking).
- A tech stands at its first assigned station until its first `techMoved`. Tech tracks are kept when Animate is toggled off and on; the marker may be stale until the tech's next walk, which starts from its own station.

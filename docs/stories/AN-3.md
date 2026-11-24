---
id: AN-3
epic: Analytics & KPIs
points: 3
priority: Must
sprint: 6
depends_on: [AN-2, SE-3]
builder_model: sonnet
owner: builder
issue: 3
---

# AN-3: Stations colored by state and the bottleneck flagged

**Story:** As a manufacturing engineer, I want stations colored by state and the bottleneck flagged so that I can find the constraint at a glance.

## Acceptance criteria

- [ ] Live colors: working green, starved yellow, blocked red, idle gray
- [ ] The station with the highest working % (or longest uninterrupted active periods) is flagged as the bottleneck
- [ ] The flag updates during the run

## Notes

- Live state comes from the engine's `stationState` events (same stream as the parts), kept as the latest state per station in `playback.stationStates`. While Animate is off no events are recorded, so plates fall back to neutral gray-white until the next state change after it is turned back on.
- Each workstation gets a state-colored plate on top (written through refs per frame); the bottleneck also gets a red ring and a BOTTLENECK label in the scene and a "▲ Bottleneck" badge in the utilization table.
- Bottleneck = highest working % of the measured window (warm-up excluded); ties go to the first in layout order; nothing is flagged until some station has worked. It is re-read ~5×/s and on state changes, so it moves during the run.
- "Longest uninterrupted active periods" (the alternative in the AC) is not used: working % is simple and already measured.

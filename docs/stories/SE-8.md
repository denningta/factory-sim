---
id: SE-8
epic: Simulation engine
points: 2
priority: Should
sprint: 6
depends_on: [SE-2]
builder_model: sonnet
owner: builder
issue: 108
---

# SE-8: Playback toolbar matches the wireframe

**Story:** As a manufacturing engineer, I want the playback toolbar laid out as designed so that long runs read clearly and speed is quick to adjust.

## Acceptance criteria

- [ ] Separate Play and Pause buttons, as in wireframe 3 (SE-2 region)
- [ ] Speed is a slider from 1× to 1000× (same clamp as SE-2)
- [ ] The clock shows `Day N, hh:mm:ss`, so a one-week run never reads past 23:59:59

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-23):_ from the review of #106. Toolbar lives in `apps/web/src/simulation/SimulateScreen.tsx`; keep `SimulateScreen.test.tsx` passing.
- _Builder:_ "Day N" is 1-indexed (a run starts at `Day 1, 00:00:00`). The slider is linear 1–1000 step 1 with a live `N×` readout; Play is disabled while playing and Pause while paused. Existing SE-2/SE-4 tests updated only for the new clock format and the slider.

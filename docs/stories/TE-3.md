---
id: TE-3
epic: Technicians
points: 3
priority: Should
sprint: 6
depends_on: [TE-2]
builder_model: sonnet
owner: builder
issue: 110
---

# TE-3: Tech markers stay correct when animation is turned back on

**Story:** As a manufacturing engineer, I want techs drawn where they really are after I turn animation back on, so that the 3D view never misleads me.

## Acceptance criteria

- [ ] After Animate is turned off and on mid-run, each tech is drawn at its current station, or mid-walk if it is walking
- [ ] After Run to end → Reset → Animate on, techs start from their home stations
- [ ] The comment in `playback.ts` about tech tracks describes the real behaviour

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-23):_ needs a sim-engine public API addition (lead-owned), e.g. `Run.techs()` listing each tech's station or current walk, tracked even with events off (like `run.wip()`). The lead lands it before dispatch. Seed `TechTracks` from it the way parts are seeded from `wip()`.

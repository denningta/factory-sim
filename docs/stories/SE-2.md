---
id: SE-2
epic: Simulation engine
points: 5
priority: Must
sprint: 5
depends_on: [SE-1]
builder_model: sonnet
owner: builder
issue: 29
---

# SE-2: Play, pause, step and speed controls

**Story:** As a manufacturing engineer, I want play, pause, step and speed controls so that I can watch the line or jump to results.

## Acceptance criteria

- [ ] Play, pause, single-step, reset
- [ ] Speed from 1× to 1000× real time
- [ ] "Run to end" with no animation finishes a one-week run in under 30 seconds for a 20-station model

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- SE-3 already built play/pause/reset/speed in `RunSession`; SE-2 adds `step` and `runToEnd` to the UI, clamps speed to 1–1000×, and tests the 20-station week.
- `runToEnd()` = animation off + play, so the host's frame loop runs it in 8 ms slices without freezing the UI.
- The engine-level timing benchmark (`line.perf.test.ts`, `BENCH=1`) already exists; the web test also runs the full week through the session.

---
id: SE-3
epic: Simulation engine
points: 8
priority: Must
sprint: 5
depends_on: [SE-1, PL-5]
builder_model: sonnet
owner: builder
issue: 30
---

# SE-3: See parts move through the line in 3D

**Story:** As a manufacturing engineer, I want to see parts move through the line in 3D so that I can see where flow breaks down.

## Acceptance criteria

- [ ] Parts are drawn in their product's color, moving along connections and queuing at stations
- [ ] Animation stays in sync with the simulation clock at any speed
- [ ] Animation can be turned off for speed

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- `apps/web/src/simulation/`: `partTracks` (events → per-part keyframes, pose at any sim time, queue slots), `playback` (sim clock driver), `PartLayer` (one InstancedMesh, ADR-0014), `SimulateScreen` (minimal Simulate tab: play/pause, speed, animate, reset). SE-2 owns the full controls and SE-4 the seed/run length (fixed seed 1, 8 h until then).
- Parts are drawn at `run.now` (the sim clock), so speed and frame rate never change the picture.
- Animation off: events disabled in the engine (results identical), run advances in 8 ms wall slices. Turning it back on clears tracks; parts already in flight appear again only once released after that.
- Queue slots are derived per frame from keyframes; processing parts are drawn above the machine so they aren't hidden inside it.

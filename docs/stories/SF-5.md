---
id: SF-5
epic: Shop floor
points: 5
priority: Must
sprint: 9
depends_on: [SF-0, SF-1, SF-6, SF-7]
builder_model: sonnet
owner: builder
issue: 176
---

# SF-5: Every part visible, carried between benches

**Story:** As a manufacturing engineer, I want to see every piece of WIP where it really is and watch it move from bench to bench so that I can see queues and blockages build up.

## Acceptance criteria

- [ ] A part in process sits on the station's `workSurface`; queued parts fill the `inTray` slots; finished parts waiting for downstream (`partFinished`) sit in the `outTray` slots
- [ ] A move runs from the upstream out-tray to the downstream in-tray at work-surface height, eased, timed by the engine's `arrivesAt` (ADR-0008). Conveyors keep their belt path
- [ ] Every part in the line is drawn exactly once. Test: on the reference model, the number of drawn parts equals `run.wip().length` at sampled times, with animation on and after turning it back on
- [ ] Autoclave: batch parts ride the cart inside the vessel; the door is open during load and unload and closed during the cure; the cure shows a progress indicator (from `batchStarted.endsAt`)
- [ ] Still one instanced mesh for parts; per-frame updates stay out of React state
- [ ] Screenshots in `docs/screenshots/SF-5/`: reference line mid-run, an autoclave curing

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-26):_ sprint 9 "Shop floor in 3D" (product owner, 2026-11-26). Load the `frontend-design` skill and add a Design section to the PR. Colours come from the active theme (UI-9). ADR-0014 budget: draw calls in the low tens, ≤ 275k visible triangles.
- _Lead:_ files: `simulation/partTracks.ts`, `simulation/PartLayer.tsx`, `simulation/playback.ts`, `simulation/StationLayer.tsx`. Uses anchors from SF-1 and SF-7 and events from SF-0/SF-6.
- _Lead (2026-11-26):_ from the SF-1 review (#184): on `machine`, `workSurface` is inside the opaque cabinet (a part in process is hidden) and the queue/tray slots sit on the cabinet roof. Make parts in process on a machine visible (e.g. through the window) and place trays where they read naturally.
- _Lead (2026-11-26), from the SF-7 review (#191):_ `asc-autoclave`'s input anchor sits at the vessel's rear (z0) while parts load through the front door. Put the in-tray/input at the door or cart. Also the SF-1 notes above still apply (machine `workSurface` hidden inside the cabinet, trays on the roof).

---
id: UI-5
epic: UI polish
points: 5
priority: Must
sprint: 8
depends_on: [UI-7, AN-4]
builder_model: sonnet
owner: builder
issue: 148
---

# UI-5: Station status visible in the 3D view

**Story:** As a manufacturing engineer, I want each station to show what it is doing and why, from any distance and in the top-down view, so that I can spot the constraint while the line runs.

## Acceptance criteria

- [ ] Each workstation has a **stack light** at its model's `statusLight` anchor (UI-7); the lit segment glows in the strong state colour and changes in the frame its `stationState` event is applied. It replaces the coloured plate on top of the machine
- [ ] A **label** above each station shows its name and `● <State> · N waiting`, where N is the number of parts queued at its input. Labels update a few times a second, not every frame, and are at least 12 px tall at Zoom to fit for the reference line (screenshot as evidence) (product owner, 2026-11-24)
- [ ] A **footprint outline** on the floor in the state colour shows state in the 2D top-down view
- [ ] **Connections** leaving a blocked station draw in the blocked colour until it unblocks
- [ ] A **legend** in a corner of the viewport: Working · Starved · Blocked · Waiting for tech · Tech walking, plus product colours
- [ ] The **bottleneck** gets a "Bottleneck" badge on its label and an accent-coloured outline (not red, which means blocked); the black ring is removed
- [ ] The engine's `idle` state is shown as **"Waiting for tech"** in every label, legend and table (product owner, 2026-11-23); the engine API is unchanged
- [ ] Per-frame colour writes go through refs, not React state. Test: a `stationState` event changes the light's material colour without re-rendering `StationLayer`
- [ ] Screenshots in `docs/screenshots/UI-5/`: 3D mid-run, 2D top-down, bottleneck flagged

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ no engine change needed. Queue counts come from the poses already built in `simulation/partTracks.ts` (`state: 'queued'` per equipment) or `Run.wip()` (last event `partEntered`). "Connection blocked" is derived from the upstream station's state. AN-4's `Run.stationStates()` seeds the lights when animation is turned back on.
- _Lead:_ prototype reference: `statusLight()` in [`docs/wireframes/prototype/models.js`](../wireframes/prototype/models.js), the per-frame light/label update in [`world-status-excerpt.js`](../wireframes/prototype/world-status-excerpt.js), and `.label3d` in `prototype.css`. Labels use the existing `TextLabel` sprite (`layout/FloorScene.tsx`); drei `Html` misbehaves under React 19.
- _Lead:_ all colours come from UI-1's tokens. The accent outline for the bottleneck settles AN-3's "dark ring" choice. Change "idle" to "Waiting for tech" in `docs/wireframes/README.md`.
- _Lead:_ not run at the same time as UI-4: both change `simulation/`.

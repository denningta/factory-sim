---
id: UI-8
epic: UI polish
points: 5
priority: Should
sprint: 9
depends_on: [UI-7, UI-9]
builder_model: sonnet
owner: builder
issue: 151
---

# UI-8: Refined equipment models, technicians and scene

**Story:** As a manufacturing engineer, I want the 3D line to look like a real shop floor at the right scale so that I can show it to colleagues and they recognise each station.

## Acceptance criteria

- [ ] New registry models, each passing UI-7's contract test: `bench` (table, static-safe mat, light bar), `machine` (enclosed cabinet with window and control pendant), `cnc-enclosure` (router cell with glass front and spindle), `flow-rack` (shelves that show queued parts in slots), `roller-conveyor` (rollers and direction chevrons), `pallet-source` (pallet with raw stock) and `shipping-sink` (pallet that stacks finished parts)
- [ ] With no `model` set, a workstation is drawn as `bench` when manual and `machine` when automatic; the other behaviors default to the models above
- [ ] **Technicians** are drawn as a simplified person figure with a badge in the tech's colour, in a working pose at a station and arms down while walking, within 1,500 triangles
- [ ] **Scene:** an isometric-style default camera (about 35° elevation, 45° azimuth) that frames the equipment whenever equipment exists; dark floor with a faint grid, background and lights from the active theme (UI-9); equipment in pale, low-contrast materials with the equipment colour as accent, as in the control-room reference. No shadows (ADR-0014 decision 6) (product owner, 2026-11-24)
- [ ] **Performance:** at the PL-5 target load (200 objects, 500 parts), `renderer.info` shows draw calls within ADR-0014's budget (low tens) and at most 275k visible triangles; numbers recorded in the PR. The product owner confirms ≥ 30 fps on the reference machine before merge (product owner, 2026-11-24)
- [ ] Screenshots in `docs/screenshots/UI-8/`: a library preview of each model, and the reference line in 3D

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ prototype reference, [`docs/wireframes/prototype/models.js`](../wireframes/prototype/models.js): `bench`, `benchMachine`, `machine`, `cncRouter`, `rack` + `rackSlot`, `pallet` + `palletSlot`, `operator` + `poseOperator` (simplify: fewer segments, no glasses), and [`scene.js`](../wireframes/prototype/scene.js) for lights and camera framing.
- _Lead:_ `Should`: carry over to sprint 9 if UI-1 to UI-7 run long.
- _Lead (2026-11-24):_ **redesign toward the control-room look** (product owner, 2026-11-24): see [`docs/wireframes/reference/`](../wireframes/reference/README.md). Load the `frontend-design` skill (and `dataviz` for charts, tiles, legends, bars) and add a Design section to the PR (builder role). Moved to sprint 9 (product owner, 2026-11-24).

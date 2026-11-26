---
id: SF-1
epic: Shop floor
points: 5
priority: Must
sprint: 9
depends_on: []
builder_model: sonnet
owner: builder
issue: 172
---

# SF-1: Industrial workbench and machine models

**Story:** As a manufacturing engineer, I want manual stations to look like the steel workbenches on my floor so that colleagues recognise the line at a glance.

## Acceptance criteria

- [ ] A `bench` registry model in the style of a typical industrial workbench (e.g. Uline): steel frame with legs and levelling feet, laminate/ESD work top, rear upright with a riser shelf, LED light bar, louvered panel with a row of bins, lower shelf. Fixed parts (legs, upright, light bar) keep their real size as the footprint changes (EQ-5)
- [ ] A `machine` registry model (enclosed cabinet with window and control pendant) for automatic stations
- [ ] With no `model` set, a manual workstation is drawn as `bench` and an automatic one as `machine`
- [ ] New anchors on workstation models: `workSurface` (where the part in process sits), `inTray` slots and `outTray` slots on the top, and `operator` with a facing direction, at the front edge outside the footprint where a person stands. Documented in `models/README.md`; the contract test checks them (inside bounds, operator not inside any part)
- [ ] Both models pass the contract test (≤ 1,500 triangles full, ≤ 200 low LOD)
- [ ] Screenshots in `docs/screenshots/SF-1/`: library preview of each model and the reference line

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-26):_ sprint 9 "Shop floor in 3D" (product owner, 2026-11-26). Load the `frontend-design` skill and add a Design section to the PR. Colours come from the active theme (UI-9). ADR-0014 budget: draw calls in the low tens, ≤ 275k visible triangles.
- _Lead:_ replaces part of UI-8 (closed). Prototype reference: `bench` and `machine` in [`docs/wireframes/prototype/models.js`](../wireframes/prototype/models.js). Stays inside `equipment/models/`; SF-2 and SF-5 use the new anchors.

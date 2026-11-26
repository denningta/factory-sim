---
id: SF-3
epic: Shop floor
points: 5
priority: Must
sprint: 9
depends_on: []
builder_model: sonnet
owner: builder
---

# SF-3: Overhead connections and a Layers menu

**Story:** As a manufacturing engineer, I want the flow between stations drawn above the line, and to hide it when I want, so that connections are clear without cluttering the floor.

## Acceptance criteria

- [ ] Connections are drawn as arcs above the equipment: rising from the output port, at about 0.5 m above the taller of the two stations, down to the input port, with a direction marker. One shared component serves the layout editor and Simulate
- [ ] Editor: clicking a connection still selects it (FL-1/FL-2 tests pass apart from selectors); the selected connection uses the accent colour
- [ ] Simulate: the flow dashes and the blocked colour (UI-5) move to the arcs
- [ ] A **Layers** menu in the viewport toolbar (editor and Simulate) with a **Connections** toggle, on by default. Remembered per viewer in browser storage (wrapped in try/catch), never saved in the project
- [ ] Draw calls for connections don't grow per connection (shared geometry or instancing)
- [ ] Screenshots in `docs/screenshots/SF-3/`: editor and Simulate, layer on and off

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-26):_ sprint 9 "Shop floor in 3D" (product owner, 2026-11-26). Load the `frontend-design` skill and add a Design section to the PR. Colours come from the active theme (UI-9). ADR-0014 budget: draw calls in the low tens, ≤ 275k visible triangles.
- _Lead:_ files: `layout/ConnectionLayer.tsx`, `simulation/RunConnections.tsx`, `simulation/callouts.ts` (`connectionLook`), `layout/ViewToolbar.tsx`, `simulation/SimulateScreen.tsx`. Ports stay as they are (SF-4 changes them). Parts don't follow the arcs (SF-5 carries them at bench height).

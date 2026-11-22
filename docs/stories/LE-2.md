---
id: LE-2
epic: Layout editor
points: 5
priority: Must
sprint: 2
depends_on: [LE-1, EQ-1]
builder_model: sonnet
owner: builder
issue: 13
---

# LE-2: Place, move, rotate and delete equipment

**Story:** As a manufacturing engineer, I want to place, move, rotate and delete equipment so that I can try layouts quickly.

## Acceptance criteria

- [ ] Dragging from the library places an object at the cursor, snapped to grid
- [ ] Objects can be moved by drag and rotated in 90° steps or to a typed angle
- [ ] Multi-select with shift-click or box select; move and delete work on the selection
- [ ] Position and rotation show in the properties panel

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- Equipment and selection live in the editor store (`equipment` in meters/radians, `selectedIds` session-only). Placement uses `instantiate()`; ids are `eq-<n>`, unique after deletes. Drops off the floor are ignored.
- Rendering follows ADR-0014: one `InstancedMesh` per (type, part). Drags preview by writing matrices through refs and commit once on release, so no React state changes per pointer move. Selection tints instance colors. Only one LOD level exists so far (follow-up).
- Pointer model: left button selects/drags/box-selects, right button orbits, wheel zooms (OrbitControls' left button is disabled). Box select uses a floor-plane rectangle and selects by item center.
- Rotation is stored in radians, normalized to [0, 2π); the panel shows degrees. Position fields are read-only for now.
- #57 folded in: camera fits on mount and on "Zoom to fit" only (store `fitTick`), grid geometry is rebuilt per floor (fresh bounding sphere), `shapeSignature` ignores tone, grid rows use `minmax(0, 1fr)`, and `resolve.dedupe` is explained.

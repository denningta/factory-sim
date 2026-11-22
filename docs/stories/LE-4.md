---
id: LE-4
epic: Layout editor
points: 3
priority: Must
sprint: 2
depends_on: [LE-1]
builder_model: sonnet
owner: builder
issue: 15
---

# LE-4: Orbit in 3D and switch to a top-down 2D view

**Story:** As a manufacturing engineer, I want to orbit in 3D and switch to a top-down 2D view so that I can both visualize and place precisely.

## Acceptance criteria

- [ ] Mouse orbit, pan and zoom in 3D
- [ ] One click toggles an orthographic top-down view
- [ ] Zoom-to-fit frames the whole floor

## Notes

- 3D controls: left button stays with select/drag (LE-2); right rotates, middle pans, wheel zooms. 2D: rotation off, right and middle pan, wheel zooms.
- 2D is a drei `OrthographicCamera` with `up = (0,0,-1)` so plan +y runs down the screen, same orientation as the 3D plan view. `pointerToFloor` already uses `Raycaster.setFromCamera`, so placing, moving and box-select work unchanged; tests cover the ortho mapping.
- Switching view refits the camera (like Zoom to fit); it does not preserve the orbit pose. `viewMode` is session-only in the editor store.
- `fitOrtho` takes the viewport in pixels (zoom = px per meter) and reuses `planBounds`, so labels stay in frame. The existing 0×0 canvas guard is kept.

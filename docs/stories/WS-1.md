---
id: WS-1
epic: Workstation config
points: 3
priority: Must
sprint: 2
depends_on: [LE-2]
builder_model: sonnet
owner: builder
issue: 35
---

# WS-1: A properties panel for the selected object

**Story:** As a manufacturing engineer, I want a properties panel for the selected object so that I can adjust every parameter in one place.

## Acceptance criteria

- [ ] Selecting an object opens its properties: name, type, dimensions, position, rotation, simulation parameters
- [ ] Edits update the 3D view immediately
- [ ] Invalid values are rejected inline with a reason

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Dimensions are read-only here** (shown in the display unit); editing them is EQ-2.
- **Validation lives in the store** (`updateEquipment`): the schema owns the rules (positive ints, `batchSize <= capacity`, no unknown keys) and its message is shown inline. Added: name must be non-blank, position must lie on the floor. Invalid input is never written to the store.
- **Field behavior:** each keystroke commits if valid; invalid text stays visible with its reason (`role="alert"`) and the field reverts to the stored value on blur.
- **Units:** position is typed in the display unit and stored in meters; conveyor speed is shown in m/s (SI, not a display-unit length).
- **Multi-select** shows only the count and rotation, as in LE-2; per-object fields need a single selection.
- **3D view:** edits go through the editor store, which `EquipmentLayer` already subscribes to, so no new rendering code was needed.

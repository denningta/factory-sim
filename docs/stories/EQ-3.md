---
id: EQ-3
epic: Equipment library
points: 8
priority: Must
sprint: 6
depends_on: [EQ-1, WS-1]
builder_model: sonnet
owner: builder
issue: 6
---

# EQ-3: Create custom equipment types (e.g., "5-axis CNC")

**Story:** As a manufacturing engineer, I want to create custom equipment types (e.g., "5-axis CNC") so that the library matches my plant.

## Acceptance criteria

- [ ] I choose a base behavior, name, footprint, height, color and default parameters
- [ ] The new type appears in my library and can be reused in any project
- [ ] Placed instances keep their own settings; I'm offered to update them when the type changes

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- `equipmentTypeSchema` already validates user-defined types, and instances keep `typeId`, so "update instances" can find them. The library table (ADR-0010) needs a migration in `apps/api`, plus API shapes, which the lead adds to `packages/schema`.
- Design (builder): `equipment_types` table (migration 0003) holds one JSONB `UserEquipmentType` per row, owned by the creating user. The library is loaded into the editor store (`userTypes`, session-only), so it is not part of the project document and works in any project.
- Saving an edited type never touches instances. If some use it, `LibrarySection` offers "Update instances"; accepting calls `syncInstancesToType`, one undo step, which copies behavior, params, size, color and ports and keeps name, position, rotation and id.
- The type form edits capacity, batch size and conveyor speed. A workstation's labor mode stays manual for a new type; automatic load/unload times are still set on the placed instance (TE-1).
- Deleting a type leaves instances in place; their `typeId` then matches no library entry and the Properties panel shows the raw id.

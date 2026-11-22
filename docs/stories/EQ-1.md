---
id: EQ-1
epic: Equipment library
points: 5
priority: Must
sprint: 2
depends_on: []
builder_model: sonnet
owner: builder
issue: 4
---

# EQ-1: A library of base equipment types

**Story:** As a manufacturing engineer, I want a library of base equipment types so that I can build a line without modeling from scratch.

## Acceptance criteria

- [ ] Library panel lists: workstation, buffer/rack, conveyor, source (material release), sink (shipping)
- [ ] Each type has a default footprint, height and simulation behavior
- [ ] Each type renders as a distinct, recognizable 3D shape

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Contract (lead, `@factory-sim/schema`):** `EquipmentType`, `equipmentTypeSchema`, `BASE_EQUIPMENT_TYPES` (the five built-ins with default footprint, height, color and behavior params), and `instantiate(type, placement)`, which places a type and gives the instance its own copy of the settings. Use these. Don't redefine shapes or defaults in `apps/web`.
- **Distinct 3D shapes** are derived from `behavior` in the renderer (ADR-0014: instancing per type and LOD level). The schema holds no mesh data.
- **Built-ins are code constants for now.** The library table (ADR-0010) arrives with EQ-3. If EQ-1 needs the library served by the API, ask the lead first.

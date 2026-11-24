---
id: UI-7
epic: UI polish
points: 5
priority: Must
sprint: 8
depends_on: [EQ-5]
builder_model: opus
owner: builder
issue:
---

# UI-7: Extensible 3D model library

**Story:** As a manufacturing engineer, I want equipment to look like what it is, and to pick a look for my own equipment types, so that the 3D line reads like my real floor.

## Acceptance criteria

- [ ] A model registry in `apps/web/src/equipment/models/`. Each model definition has an `id` (kebab-case, ADR-0015), a label, the behaviors it suits, `build(size, params)` returning parts tagged with a **material role** (frame, body, accent, dark, glass, screen), **anchors** (`label`, `input`, `output`, `queueSlot(i)`, and `statusLight` and `operator` for workstations) and LOD levels. Adding a model is one file plus one registry entry, documented in `models/README.md`
- [ ] Material roles map to one shared material set; `body` takes the equipment's colour. The `tone` multiplier is gone
- [ ] Parts marked fixed (legs, posts, rails, light pole) keep their real size when the footprint or height changes, consistent with EQ-5
- [ ] `resolveModel(equipment)` returns the equipment's `model` if it is registered and suits its behavior, otherwise the behavior's default. Tests: absent, unknown and wrong-behavior ids fall back
- [ ] One source for every view: the library preview, the floor (`EquipmentLayer`) and the simulation layers render from the registry; parts queue at the `queueSlot` anchors and techs stand at the `operator` anchor. Instancing groups are keyed by (model, LOD)
- [ ] The type editor (EQ-3) offers a **model picker** listing only registry models that suit the type's behavior, with the preview updating as you choose. No free-text ids
- [ ] **Contract test** over every registered model at minimum, default and large sizes: parts fit inside the footprint and height, anchors lie inside the bounds, at most 1,500 triangles at full detail and 200 at the lowest LOD, and the same input builds the same parts
- [ ] The five current shapes are ported as the behavior defaults, so the floor looks the same apart from materials (UI-8 refines them)

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ schema support merged in #138 (ADR-0015, schema v7): optional `model` on types and instances, copied by `instantiate`, unknown ids fall back. Don't change `packages/schema`.
- _Lead:_ builds on EQ-5 (merged in sprint 7), which reworked `layout/equipmentGroups.ts` and per-part scaling. ADR-0014 budget: draw calls in the low tens, about 275k visible triangles; the 1,500 per model allows about 180 detailed objects.
- _Lead:_ current code: `equipment/shapes.ts`, `equipment/EquipmentModel.tsx`, `layout/EquipmentLayer.tsx`, `layout/equipmentGroups.ts`, `simulation/partTracks.ts` (queue origin), `equipment/TypeEditor.tsx`. Prototype reference for anchors and slots: `rackSlot`, `ovenSlot` and `cartSlot` in [`docs/wireframes/prototype/models.js`](../wireframes/prototype/models.js), and the per-equipment anchor table `SPECS` in [`world-status-excerpt.js`](../wireframes/prototype/world-status-excerpt.js).

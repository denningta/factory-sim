---
id: UI-7
epic: UI polish
points: 5
priority: Must
sprint: 8
depends_on: [EQ-5]
builder_model: opus
owner: builder
issue: 150
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
- _Builder (2026-11-24):_ design decisions.
  - **Registry:** `apps/web/src/equipment/models/`: one file per model, `MODELS` plus behavior `DEFAULTS` in `registry.ts`, and `buildModel(e)` as the single entry point. `shapes.ts` is gone. The five ported defaults are `workstation-cell`, `buffer-rack`, `conveyor-belt`, `source-hopper` and `sink-container`, with the same parts and proportions as before.
  - **Materials:** `materials.ts` holds one shared `MeshStandardMaterial` per role, all white. The part's colour goes through the instance colour (`roleColor`: equipment colour for `body`, the role's colour otherwise) and is then tinted for selection and overlap. The floor and the previews both draw through instanced meshes, so one material set serves every view.
  - **LOD:** by 3D camera distance to the item centre (not horizontal only, so zooming straight out also drops detail). Each (model, LOD, part) mesh can hold every item of its group, and the items at that LOD fill its first `count` slots. `useFrame` recomputes the split and rewrites matrices only when an item changes level (ADR-0014). The ported defaults switch at 150 m: they cost at most about 130 triangles at full detail, and at 40 m the default zoom-to-fit view was already showing boxes.
  - **Group key:** the model id plus the parts' structure (shape, role, segments, taper). In practice that is (model, LOD). The structure part only matters if a model's params change its parts.
  - **Anchors:** queue slots fill a grid on the equipment (cabinet top behind the machine, the rack's crate tops, the belt, the pallet stack; a contract check keeps every slot out of the parts so waiting parts stay visible) and then pile up, capped at the height, so every slot stays inside the bounds and a long queue never spills over the floor. Parts are drawn 0.3 m wide (was 0.6) to fit the 0.35 m slot pitch. The workstation operator anchor is on the footprint edge (local −x, the side away from the pole), so the tech capsule overlaps the cabinet slightly; UI-8 can refine this. Techs walk between operator anchors over the engine's walk time.
  - **Picker:** the options are "Behavior default (label)" (saves no `model`) plus `modelsFor(behavior)`. Changing the behavior of a new type resets it to the default.
  - **AC3 test:** a fixed part's horizontal sides keep their real size unless they span the footprint (conveyor rails run the full belt length), and at least one side is real.

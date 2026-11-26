# 3D model library

Every 3D model the app draws comes from this folder (UI-7, ADR-0014, ADR-0015). The library
preview, the type editor's preview, the floor (`layout/EquipmentLayer.tsx`) and the simulation
layers (queue slots, operator spot) all read the registry. Nothing else knows about shapes.

## Adding a model

1. **One file**, e.g. `cnc-enclosure.ts`, exporting a `ModelDefinition` (`types.ts`):

   ```ts
   export const cncEnclosure: ModelDefinition = {
     id: 'cnc-enclosure', // kebab-case, ≤ 64 chars; stored in `model` on types and instances
     label: 'CNC enclosure', // shown in the type editor's model picker
     behaviors: ['workstation'], // the picker only offers it for these
     lodDistances: [60], // beyond 60 m camera distance, draw lods[1]
     build({ width, length, height }, params) {
       return {
         lods: [fullDetail, cheap],
         anchors: { label, input, output, queueSlot, statusLight, operator },
       };
     },
   };
   ```

2. **One registry entry**: add it to `MODELS` in `registry.ts`. To make it a behavior's
   default, change `DEFAULTS` there too.

Then run `pnpm --filter @factory-sim/web test -- models`. The contract test (`contract.test.ts`)
checks every registered model automatically.

## Rules a model must follow

- **Model space:** meters, origin at the footprint center on the floor, x across the width,
  z along the length, y up. Default ports sit at the back (−z, input) and front (+z, output).
- **Parts** are boxes and cylinders built with `slab` / `cyl` (`parts.ts`), each with a
  **material role**: `frame`, `body`, `accent`, `dark`, `glass` or `screen`. Roles map to the one
  shared material set in `materials.ts`; only `body` takes the equipment's color.
- **Fixed parts:** legs, posts, rails and poles use real sizes in meters (`real(m, available)`),
  marked `fixed: true`, so a bigger machine doesn't get thicker legs. Everything else scales with
  the footprint and height.
- **Same structure at every size:** the part count, shapes, roles, cylinder segments and taper
  must not depend on size, because instances of a model share instanced meshes. Params may
  change the structure (the floor then groups those instances separately), but prefer not to.
- **Deterministic:** the same size and params build the same parts.
- **Budget:** at most 1,500 triangles at full detail and 200 at the cheapest LOD (a box is 12
  triangles, a 24-segment cylinder 96). At least two LODs.
- **Anchors** lie inside the footprint and height: `label`, `input`, `output`, `queueSlot(i)` for
  every i (use `gridSlots` from `anchors.ts`, which piles parts up instead of spilling), and for
  workstations `statusLight` and `operator`.

## Workstation anchors (SF-1)

Bench- and machine-style workstation models add these optional anchors, which the simulation
layers use to place parts and people:

- `workSurface`: where the part in process sits.
- `inTray` / `outTray`: lists of slots on the top where parts are handed in and picked up. They
  lie inside the footprint and not inside any part.
- `operator` + `operatorFacing`: where a person stands, on the floor just outside the front edge
  (+z, `OPERATOR_OFFSET` = 0.45 m from it), and the unit vector (x, 0, z) they look along. When
  `operatorFacing` is set the contract test requires `operator` to be outside the footprint,
  in front of it and not inside any part, instead of inside the bounds.

## Choosing a model

`resolveModel(equipment)` returns the equipment's `model` when it is registered and suits the
behavior, otherwise the behavior's default (a manual workstation is a `bench`, an automatic one a
`machine`; every other behavior has one default), so a stale or unknown id never breaks a project.

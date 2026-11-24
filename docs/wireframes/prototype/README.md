# Prototype reference (sprint 8)

Files copied from the product owner's earlier prototype, the _Lean Flow Simulator_ (plain ES modules, vanilla three.js 0.160, no build step). They are here so builders can read them inside their worktrees. **Reference only:** nothing imports them, lint and prettier skip them, and they are copied as-is. Port the ideas to React Three Fiber, our tokens and our conventions (SI units, refs and `useFrame` for per-frame work, ADR-0014 budgets). Don't copy the prototype's simulation semantics: its states (`waitMachine`, `curing`, `down`, …) are not ours.

| File | What it shows | Used by |
| --- | --- | --- |
| [prototype.css](prototype.css) | Palette as CSS variables (light and dark), state colours, `.kpi` tiles, `.legend`, `.tabs`, `.hud` floating playback bar, `label.f` fields, `#inspector details` sections, `.label3d` 3D labels | UI-1, UI-2, UI-3, UI-4, UI-5 |
| [layout.html](layout.html) | Page structure: side panel, viewport with the floating HUD, bottom tabs and KPIs, legend | UI-1, UI-4 |
| [inspector.js](inspector.js) | Properties grouped into collapsible `<details>` sections | UI-3 |
| [models.js](models.js) | Procedural models: `bench`, `benchMachine`, `machine`, `cncRouter`, `rack` + `rackSlot`, `pallet` + `palletSlot`, `oven`/`autoclave` + slot functions, `operator` + `poseOperator`, `statusLight` (andon stack light) | UI-5, UI-7, UI-8 |
| [world-status-excerpt.js](world-status-excerpt.js) | State → colour/text maps, per-equipment anchors (`SPECS`: work surface, input/output slots, operator position), and the per-frame stack light and label update | UI-5, UI-7 |
| [scene.js](scene.js) | Lights, floor and grid themed from CSS variables, camera framing (`frameAll`) | UI-8 |

The state colours in `prototype.css` are the starting values for UI-1's `tokens.ts`. Once UI-1 merges, `apps/web/src/ui/tokens.ts` is the source of truth, not this folder.

---
id: SF-7
epic: Shop floor
points: 5
priority: Must
sprint: 9
depends_on: [SF-0, SF-1]
builder_model: sonnet
owner: builder
---

# SF-7: ASC autoclave model and equipment type

**Story:** As a manufacturing engineer, I want to place an autoclave in my line and set its cure time and batch size so that I can see how curing affects flow.

## Acceptance criteria

- [ ] An `asc-autoclave` registry model: horizontal cylindrical pressure vessel on saddle supports, domed door with hinge, load rails and a cart with `queueSlot`/batch slots, control cabinet, status light. Passes the contract test
- [ ] A built-in **Autoclave** equipment type in the library: workstation behavior, automatic labor, `cycle: perBatch` with a sensible default cure time, `batchSize` and `maxWait`, footprint to real scale, model `asc-autoclave`
- [ ] The type editor and properties panel edit cure time, batch size and max wait, in display units with SI storage; switching cycle mode hides or shows the per-product cycle times. Test per field
- [ ] Screenshots in `docs/screenshots/SF-7/`: library preview and the autoclave placed on the reference line

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-26):_ sprint 9 "Shop floor in 3D" (product owner, 2026-11-26). Load the `frontend-design` skill and add a Design section to the PR. Colours come from the active theme (UI-9). ADR-0014 budget: draw calls in the low tens, ≤ 275k visible triangles.
- _Lead:_ stays in `equipment/` (models, `TypeEditor.tsx`, `PropertiesPanel.tsx`) and the built-in type list; door and cure animation is SF-5. If the built-in type needs `packages/schema` (`BASE_EQUIPMENT_TYPES`), report to the lead.

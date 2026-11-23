---
id: PR-2
epic: Products & routings
points: 8
priority: Must
sprint: 3
depends_on: [PR-1, EQ-1]
builder_model: opus
owner: builder
issue: 24
---

# PR-2: Define each product's routing (ordered operations)

**Story:** As a manufacturing engineer, I want to define each product's routing (ordered operations) so that different products can take different paths through shared stations.

## Acceptance criteria

- [ ] Add, reorder and remove routing steps, each assigned to a station
- [ ] The same station can appear in many products' routings
- [ ] Steps whose station is unreachable by connections are flagged

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- Routing steps already exist in the schema (`product.routing[] = {id, stationId}`, stations must be workstations). AC3 reachability: compute it over v3 connections (port graph from each source), as a pure, tested function. FL-3 reuses it for routing at splits.
- Reachability (builder): `apps/web/src/products/reachability.ts`. `reachableFromSources` runs a breadth-first search from every source along `connections`. A part entering equipment can leave by any of its outputs, so the port graph collapses to equipment → equipment edges. `reachableFrom(graph, starts)` is exported for FL-3, which can check that step n+1 is reachable from step n. If FL-3 needs it inside the engine, the lead can move it into a package.
- A step is "unreachable" when no source can reach its station; such steps get a warning on their row. A station that can't reach a sink isn't flagged (not in the AC).
- Steps have only `{id, stationId}`, so the wireframe's operation name ("Cut stock") isn't shown; the row shows the station's name. Adding a name needs a schema change (lead).
- Deleting a station on the Layout removes the routing steps that used it, in the same undo step. Otherwise the document would fail validation on save.
- The editor store now holds `connections` (loaded from the document, read-only here), the same field FL-1 adds. Whichever story merges second resolves the trivial conflict.
- Reorder: drag a row, or use the ↑/↓ buttons (keyboard accessible).

---
id: PS-2
epic: Parallel stations
points: 5
priority: Must
sprint: 10
depends_on: [PS-0]
builder_model: sonnet
owner: builder
issue: 207
---

# PS-2: Add parallel stations to a routing step

**Story:** As a manufacturing engineer, I want to mark stations as parallel in a routing step so that I can model a second machine without rewriting the routing.

## Acceptance criteria

- [ ] In the routing editor a step shows its stations ("Autoclave 1 or Autoclave 2"), with "+ Parallel station" to add a workstation and a remove button per alternate
- [ ] Adding an alternate copies the primary's cycle time for that product (if it has one) into the cycle-time table, marked so the user can change it
- [ ] In Layout, connecting one output to a second station of the same type as a routed station offers "Use as parallel station for <step>?"; accepting adds it to every step that routes to the first station
- [ ] Deleting a station removes it from all alternates and promotes the first alternate if it was primary (ADR-0018)
- [ ] Pre-run checks show the new `no_path` / missing-cycle-time issues on the right step and station
- [ ] Screenshots in `docs/screenshots/PS-2/`

## Notes

- _Lead (2026-11-27):_ stays in `products/` and the layout connect flow; no engine change.
- _Builder (2026-11-28):_ "+ Parallel station" adds the first unused workstation, preferring the primary's type; it's a store action, so the choice can be refined later. The copied-time mark (`copiedCycleTimes`) is session-only, like `pendingFrom`: it isn't saved in the document. The connect offer fires when the new input's station has the same `typeId` as another station fed by the same output port and routed in a step. No engine change; engine-side `no_path`/`missing_cycle_time` for alternates is PS-1's. The web pre-run list covers alternates (missing cycle time per station, staffing per station).

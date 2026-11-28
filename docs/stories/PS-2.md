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

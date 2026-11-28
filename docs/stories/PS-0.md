---
id: PS-0
epic: Parallel stations
points: 2
priority: Must
sprint: 10
depends_on: []
builder_model: opus
owner: lead
issue: 205
---

# PS-0: Contract for parallel stations (schema v9)

**Story:** As the lead, I want the parallel-station contract in place so that the engine and editor stories can start in parallel.

## Acceptance criteria

- [ ] ADR-0018 accepted by the product owner
- [ ] Schema v9: `routingStepSchema.alternates?: id[]`; upgrade v8 → v9 only sets the version; the reference model is bumped to v9 and its results are unchanged
- [ ] Validation: alternates are known workstations, distinct, not the step's `stationId`; error paths `products[i].routing[j].alternates[k]`
- [ ] Tests: upgrade, round trip, each validation rule

## Notes

- _Lead (2026-11-27):_ requested by the product owner ("Test 1": autoclave bottleneck, second autoclave in parallel). Decisions in ADR-0018: alternatives in the routing, first with room, consolidate batches.

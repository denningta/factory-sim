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

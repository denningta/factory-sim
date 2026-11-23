---
id: PR-4
epic: Products & routings
points: 5
priority: Must
sprint: 4
depends_on: [PR-1]
builder_model: sonnet
owner: builder
issue: 26
---

# PR-4: Set demand mix and release rules

**Story:** As a production manager, I want to set demand mix and release rules so that the simulation reflects how we actually schedule work.

## Acceptance criteria

- [ ] Demand per product as units per shift or % of mix
- [ ] Release rule options: fixed interval, random by mix, repeating sequence (heijunka pattern)
- [ ] Over a long run, released quantities match the mix within 2%

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **One source for now:** `release` is project-wide. The line model requires exactly one `source` and reports a `ModelIssue` (`multiple_sources`) otherwise. Per-source release rules would be a schema change through the lead.
- When products are deleted, `removeProduct` must also drop them from `demand.items` and `release.product.pattern` (same undo step), or autosave fails validation.

- **Contract (schema v4):** `project.demand = {basis: 'perShift'|'mix', items: [{productId, value}]}` (mix sums to 100) and `project.release = {interval: Duration, product: {kind: 'smooth'|'random'} | {kind: 'sequence', pattern}}`. The three options map to: fixed interval → `fixed` interval + `smooth`; random by mix → `random`; heijunka → `sequence`. `project.calendar.shiftLength` converts per-shift demand into an interval in the UI. The AC3 'mix within 2%' test runs on the line model (SE-6).

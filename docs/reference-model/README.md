# Reference model (regression test)

ADR-0012: a small model with known results runs in CI so that engine changes that shift results are caught.

**Status:** spec stub. Expected results are filled in when SE-1 (engine) and AN-1 (KPIs) land. Owner: lead.

## Line (from the wireframes)

```
Source → S1 Saw → S2 CNC → S3 Weld → S4 Assemble → S5 Inspect → Sink
```

| Station     | Product A      | Product B                 | Tech   |
| ----------- | -------------- | ------------------------- | ------ |
| S1 Saw      | routed         | routed                    | Tech 1 |
| S2 CNC      | routed         | **not routed** (bypasses) | Tech 1 |
| S3 Weld     | routed         | routed                    | Tech 2 |
| S4 Assemble | **not routed** | routed                    | Tech 3 |
| S5 Inspect  | routed         | routed                    | Tech 3 |

Products A and B, mix and release rule (e.g. heijunka `A A B A B`), cycle times (fixed and distributions), buffer capacities and seed are to be fixed here as exact numbers.

## Files to add

- `model.json`: the project document, valid against `packages/schema` (current schemaVersion).
- `expected.json`: per-product throughput, WIP, lead time, station state %, with tolerances.
- A Vitest test in `packages/sim-engine` that loads both and asserts within tolerance, for a fixed seed (exact) and across seeds (statistical).

Design intent: S3 Weld is the bottleneck (as in the wireframes), so S1–S2 show blocking and S4–S5 starving.

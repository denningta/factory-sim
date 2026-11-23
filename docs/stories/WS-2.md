---
id: WS-2
epic: Workstation config
points: 5
priority: Must
sprint: 4
depends_on: [PR-3]
builder_model: sonnet
owner: builder
issue: 36
---

# WS-2: Cycle times as fixed values or statistical distributions

**Story:** As a manufacturing engineer, I want cycle times as fixed values or statistical distributions so that variability is modeled realistically.

## Acceptance criteria

- [ ] Supported: fixed, normal (mean, std dev), triangular (min, most likely, max), lognormal, exponential
- [ ] A small histogram previews the distribution
- [ ] Negative samples are prevented (truncated)
- [ ] Each cycle-time cell in the product × station grid (PR-3) can take any of these distributions

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Contract (schema v4):** `durationSchema` has `fixed`, `normal{mean,stdDev}`, `triangular{min,mode,max}`, `lognormal{mean,stdDev}` (of the duration itself) and `exponential{mean}`, all in seconds. Sampling and truncation at 0 belong to the engine (SE-6). The histogram preview samples with a seeded `createRng` from `@factory-sim/sim-engine`. Code that reads `time.value` must check `kind === 'fixed'` first.

- **AC added (product owner, 2026-11-22):** the PR-3 grid's "or a distribution" criterion moved here. The lead extends `durationSchema` with the new kinds (a schema bump) before this story starts.

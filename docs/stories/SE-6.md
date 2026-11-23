---
id: SE-6
epic: Simulation engine
points: 8
priority: Must
sprint: 4
depends_on: [SE-1, PR-3, FL-2]
builder_model: opus
owner: builder
issue: 91
---

# SE-6: Run a project as a simulation

**Story:** As a manufacturing engineer, I want my project to run as a discrete-event simulation so that I can see how the line actually behaves.

_Added by the lead with product-owner approval (2026-11-22). SE-1 built the kernel only; this story builds the line model on top of it, and WS-3, FL-3, PR-4 and FL-4 extend it._

## Acceptance criteria

- [ ] The 5-station, 2-product reference model (`docs/reference-model/`) runs end to end through `compileLine` / `createRun` and matches `expected.json` within its tolerances
- [ ] The same seed and project give identical events and statistics, with events enabled or disabled
- [ ] Pre-run checks report problems as `ModelIssue`s linked to the object: no products, a routing step with no path, a manual station without a technician, no source or no sink, more than one source
- [ ] Statistics exclude the warm-up and pass a Little's-law check (WIP ≈ throughput × lead time) within 5%

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Implement behind the fixed API** in `packages/sim-engine/src/line-api.ts` (`compileLine`, `createRun`, `LineEvent`, `RunStats`). The station-state precedence and event semantics are defined there. If the API needs a change, stop and ask the lead.
- **Scope:**
  - release from the single source per `project.release` (smooth / random / sequence; interval sampled from the duration)
  - routing by each part's next step
  - workstations as kernel `Resource`s (capacity), batches
  - buffers and connections as finite `Queue`s (connection capacity 0 = direct hand-off; null = unbounded)
  - transfer time per `connection.transfer`
  - conveyors at belt speed
  - manual/automatic labor with technicians as resources (walking at `walkSpeed` between stations)
  - statistics per `RunStats`
- WS-3, FL-3, PR-4 and FL-4 add their own acceptance tests on top. Build the mechanics here so those stories mostly test and polish.
- Distributions: sample each `Duration` kind from a per-object forked stream, truncate at 0, and use the engine's exact-math `log` (no `Math.log`/`exp`/`pow`; lint enforces it). The normal and lognormal samplers need exact-math versions too.
- `step()` advances to the next moment with a `LineEvent`. Disabling events must not change results (test it).
- Performance target for SE-2 ("a one-week run of a 20-station model in under 30 s"): keep per-event work allocation-free where practical, and add a benchmark test (not in CI) to confirm.

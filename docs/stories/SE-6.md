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
- **Design decisions (builder, SE-6):**
  - _Routes_ are precomputed by `compileLine`: from the source to each routing step's station, then to the nearest sink, using the fewest connections. Paths may pass through buffers and conveyors but never through a workstation that isn't the next step, so a bypass needs its own connection (the reference model's B1/B3 bypasses). The first missing path per product is reported as `no_path` on that routing step.
  - _Places:_ connections, buffers, conveyors, workstations and sinks each have a capacity and a FIFO of parts waiting for room. Room is reserved when granted, and the move is delivered as a zero-delay event. A capacity-0 connection reserves room in the next node instead, so the part leaves upstream only when downstream can take it, then travels the transfer time. Conveyors are unbounded (no part size yet) and take footprint length ÷ speed.
  - _Workstations_ hold at most `capacity` parts and have no implicit input queue. A batch is the next `batchSize` parts in arrival order, timed with the first part's cycle time (WS-3 may refine mixed batches). Techs are kernel `Resource`s (capacity 1). A station asks all its techs and takes the first one granted. Walking time is the distance between station centers ÷ `walkSpeed`. A tech starts at its first assigned station. An automatic station without a tech loads and unloads unattended.
  - _Release:_ `smooth` gives the next part to the product with the largest accumulated share of demand (ties go to document order). `random` draws by demand weight. With no demand, all products get equal weights.
  - _Window:_ events exactly at `warmUp + runLength` are included. Events at `warmUp` count after the reset.
  - _Streams:_ `release`, `release-product`, `cycle:<product>:<station>`, `load:<station>`, `unload:<station>`, `transfer:<connection>`.
  - _Performance:_ `line.perf.test.ts` (run with `BENCH=1`) runs one week of a 20-station line in about 1 s with events on.
  - _Product owner decision (2026-11-23):_ `manual_station_without_tech` is raised only for manual workstations that some product's routing uses. Unrouted stations raise no issue.
  - _Source (line-api rule from #93):_ a part is released only when its first hop has room, so nothing queues at the source. The next release is due one interval after it.
  - _Same station twice in a row_ in a routing reports `no_path` on the second step: no path leads from a station back to itself, not even a loop through a buffer or conveyor (for WS-3/FL-3). Repeated work at one station is one step with the combined cycle time.

---
id: PS-1
epic: Parallel stations
points: 8
priority: Must
sprint: 10
depends_on: [PS-0]
builder_model: opus
owner: builder
issue: 206
---

# PS-1: Engine dispatches parts across parallel stations

**Story:** As a manufacturing engineer, I want parts to use whichever parallel station is free so that adding a second machine raises throughput.

## Acceptance criteria

- [ ] A routing step with alternates sends each part, when it is ready to leave for that step, to a candidate whose first place has room; ties go to the fewest parts waiting, then listed order (`stationId` first). With no room anywhere it waits for whichever frees first (ADR-0018 §2)
- [ ] Parallel `perBatch` stations consolidate: a part prefers a station that is already loading; a second one starts loading only when the first is full or curing; `maxWait` is per station (ADR-0018 §3)
- [ ] Compile checks a path for every (previous-step station, this-step station) pair and every last-step station to a sink; a missing pair is a `no_path` issue naming both stations. Every alternate needs a cycle time unless it is `perBatch`
- [ ] A test per row of ADR-0018's edge-case table that concerns the engine
- [ ] Two identical autoclaves in parallel give about 2× the autoclave-step throughput of one when it is the bottleneck (test on a fixture line)
- [ ] Determinism (same seed ⇒ identical event log) and the reference-model regression are unchanged; engine coverage ≥ 90%

## Notes

- _Lead (2026-11-27):_ internal to `line-compile.ts` / `line-run.ts`; `LineEvent`s don't change (`partMoved.via.connectionId` shows the branch). If you need a public API change, stop and report to the lead.
- _Builder (2026-11-28):_ design decisions.
  - **Routes are per-step candidate sets.** `compileLine` stores, for each step and each place a part can start it from (the source or any station of the previous step), the shortest path to each candidate in listed order. At run time a part keeps the candidates it hasn't ruled out and walks their shared legs. It chooses where the paths split: at the previous station when each autoclave has its own buffer, or at a shared buffer. One candidate per step is today's behaviour, event for event (the reference model is unchanged).
  - **"Parts waiting for it"** = parts bound for the station that haven't left it yet (en route, waiting, in process or finished and blocked). Counting only parts that haven't started would send a part to a busy station while its twin sits idle.
  - **Batch ranking** (applies to all batch stations: perBatch and `batchSize` > 1). Tiers: loading (partial load, not curing) → idle → curing with a partial load → curing with nothing queued → curing with full batches queued. Within a curing tier the cure that ends first wins, then fewest bound, then listed order. Ordering by cure end is what keeps at most one station partially loaded when unlimited links let a part commit to a station mid-cure.
  - **No room anywhere:** the part queues on every candidate's first place and takes whichever grants first; its other places are released at that moment.
  - **Issues:** `no_path` names both stations (or the station and "a sink"); `no_path` and `missing_cycle_time` keep `objectId` = the routing step's id (lead, for PS-2).

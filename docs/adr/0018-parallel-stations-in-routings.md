# ADR-0018: Parallel stations as routing-step alternatives

- **Status:** Accepted (product owner, 2026-11-28)
- **Date:** 2026-11-27
- **Amends:** ADR-0009 (a routing step points at one station _or a set of interchangeable stations_), ADR-0017 (how parallel batch stations share parts)

## Context

To meet takt, an engineer adds a second autoclave next to the first and connects the upstream buffer's OUT to both INs. The schema already allows one output to feed several inputs, but nothing uses the second autoclave:

- A routing step names exactly one station (`routingStepSchema.stationId`).
- `compileLine` resolves each product's route once, as a fixed list of legs (the shortest path to that one station). Every part goes to Autoclave 1.

FL-3 "routing at splits" only covers product splits: product A goes one way and product B the other. It doesn't cover parts of the same product sharing equivalent machines.

## Decision

1. **Alternatives in the routing.** A routing step gets an optional `alternates: id[]`: other workstations that can do the same operation. The step's work goes to `stationId` _or_ any alternate. The field is optional, so the v8 → v9 upgrade only bumps the version, and existing projects and the reference model are unchanged. Validation:
   - Alternates are distinct workstations, not equal to `stationId`, and unique within the step.
   - Cycle times stay keyed by (product, station). Every alternate needs one unless it is a `perBatch` station.
2. **Late binding, first with room.**
   - A part chooses its station when it is ready to leave for that step, not at release.
   - Of the candidates whose first place (the connection, or the station on a direct hand-off) has room, it takes the one with the fewest parts already waiting for it. A remaining tie goes to listed order (`stationId` first).
   - If none has room, the part waits for whichever frees up first.
   - No randomness is involved, so same seed + model ⇒ identical results.
3. **Batch stations consolidate.** Among parallel `perBatch` stations, a part prefers one that is already loading: it has waiting parts and isn't curing. A second autoclave only starts loading once the first is full or curing. `maxWait` runs separately on each station. _Amended (product owner, 2026-11-28, PS-1 review):_ this applies to every batching station (`batchSize > 1`), not only `perBatch` ones. Among stations that are all running a cycle, the part goes to the one that finishes first.
4. **Paths are checked for every pair.** Compile checks a path from every station of the previous step to every station of this step (through buffers and conveyors only, as today), and from every last-step station to a sink. A missing pair is a `no_path` issue that names both stations. Routes become per-step candidate sets, resolved at run time; this is internal to `line-compile`/`line-run`.
5. **Engine API:** `LineEvent`s are unchanged. `partMoved.via.connectionId` already says which branch a part took, so the renderer needs nothing new. Results stay per station. The web app groups a step's stations for the bottleneck view.

## Edge cases (specified, each needs a test)

| Case                                                                        | Behaviour                                                                                                                                                               |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Both stations have room                                                     | Fewest parts waiting, then listed order                                                                                                                                 |
| Neither has room                                                            | The part waits upstream (in the buffer, or blocks its station on a direct hand-off) and takes whichever frees first                                                     |
| Paths diverge before the buffer (a separate buffer per autoclave)           | The choice is made when leaving the previous station, using each branch's first place                                                                                   |
| Manual alternates                                                           | Each station needs its own staffing. The existing "manual station has no technician" error applies per station                                                          |
| Different cycle times at alternates                                         | Allowed: each station uses its own (product, station) time                                                                                                              |
| Alternates of different types (e.g. CNC + manual bench)                     | Allowed: the user says they're interchangeable                                                                                                                          |
| A station is an alternate in one product's routing and primary in another's | Allowed: stations are shared across routings as today                                                                                                                   |
| Deleting a station                                                          | It is removed from every `alternates`. If it was the primary, the first alternate is promoted. If nothing remains, the step is left without a station, as today         |
| Batch stations, partial load                                                | `maxWait` per station. Consolidation means at most one station is partially loaded at a time, unless an upstream path reaches only one of them                          |
| Bottleneck / utilization                                                    | Per station as today. The bottleneck view also treats a step's stations as a group (e.g. "Cure ×2", average utilization), so two 60% autoclaves don't hide a constraint |

## Consequences

- Positive:
  - Parallel capacity is explicit, works for any workstation, and keeps per-station cycle times and staffing.
  - Old projects and the reference model are unchanged.
  - Dispatch stays deterministic.
- Negative:
  - The routing editor and results need group-aware UI.
  - Compile checks more path pairs (steps × alternates; small in practice).
  - Routes are no longer a precomputed list, so `line-run` must pick legs at run time.
- Not covered: weighted splits, round robin, configurable dispatch rules, and breakdowns. Those are separate decisions if needed.

## Alternatives considered

- **Infer parallelism from connections** (one output feeding two matching stations): no routing edit, but implicit, and ambiguous when stations differ or routes cross.
- **A unit count on one station** (`units: 2`): the smallest engine change, but only one model on the floor, with no separate placement, staffing or utilization.
- **Round robin / spread evenly:** simpler to explain, but it sends parts to a busy machine while another sits idle, and gives more half-empty cures.

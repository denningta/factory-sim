---
id: SE-1
epic: Simulation engine
points: 8
priority: Must
sprint: 1
depends_on: []
builder_model: opus
owner: builder
issue: 28
---

# SE-1: A discrete-event simulation engine in a shared TypeScript package

**Story:** As a developer, I want a discrete-event simulation engine in a shared TypeScript package so that the same model runs in the browser and on the server with identical results.

## Acceptance criteria

- [ ] Event calendar, entities (parts), resources (stations, techs) and queues
- [ ] Runs with no 3D view attached
- [ ] Results match an M/M/1 queue's theoretical waiting time within 2% over a long run
- [ ] Unit-tested to 90%+ coverage

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Public API is fixed** in `packages/sim-engine/src/api.ts` and `index.ts` (lead). Implement `createSimulation`, `createRng` and `createTally` in `simulation.ts`, `rng.ts` and `stats.ts`, and add internal modules as needed. If the API needs to change, stop and tell the lead.
- Follow the determinism rules in the `api.ts` header: tie-breaking by (time, priority, schedule order); FIFO waits; grants delivered as zero-delay events.
- PRNG: the builder's choice (e.g. sfc32 or xoshiro128** seeded via splitmix32), but integer-only so it's bit-exact in every JS runtime. Document it, because changing it later changes reference-model results.
- **No `Math.log`/`exp`/`pow`/trig in result-affecting code** (they may differ in the last bit between engines). `exponential()` needs a log: implement one from exact operations (e.g. port fdlibm's `__ieee754_log`), with a test comparing it to `Math.log` within 1 ulp over a sample of inputs.
- Use `WaitHandle.cancel()` semantics from `api.ts` (withdraw before grant; false after).
- CI enforces ≥ 90% coverage on `packages/sim-engine/src/**` (`vitest.config.ts`).
- M/M/1 AC: use λ < μ (e.g. ρ = 0.8), a warm-up reset via `resetStatistics()`, and a run long enough that the mean wait Wq = ρ/(μ−λ) is within 2% for a fixed seed. Keep the test under a few seconds.
- Out of scope: the line model (`Project` → run) and the renderer event stream. The lead defines those before SE-2/SE-3/SE-4.

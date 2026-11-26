---
id: SF-6
epic: Shop floor
points: 5
priority: Must
sprint: 9
depends_on: [SF-0]
builder_model: opus
owner: builder
issue: 177
---

# SF-6: Autoclave cure cycle in the engine

**Story:** As a manufacturing engineer, I want a batch station that cures a load for a fixed time, and starts a part-full load after a maximum wait, so that I can model an autoclave in my line.

## Acceptance criteria

- [ ] `cycle.mode = 'perBatch'`: one cure of `cycle.time` per batch, whatever the number or mix of parts. Such a station needs no `cycleTimes` entries (no `missing_cycle_time` issue). Test: cure time independent of batch size and product mix
- [ ] `maxWait`: a partial batch starts once the first waiting part has waited `maxWait`; a full batch still starts at once. Test: partial start time, timer cancelled by a full batch
- [ ] The engine emits `batchStarted` (with `endsAt` for both manual and automatic stations), `batchFinished` and `partFinished` (SF-0 types)
- [ ] Load and unload stay once per batch (automatic labor)
- [ ] Same seed + model gives identical results; reference-model results unchanged; engine coverage ≥ 90%

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-26):_ files: `packages/sim-engine/src/line-run.ts` (`tryStart`, `startJob`), `line-compile.ts` (`StationDef`, `missing_cycle_time`). Don't change the public API beyond the SF-0 types; report to the lead if you need to. Contract: ADR-0017 (`cycle`, `maxWait` optional; absent = today's behavior). Opus builder (product owner, 2026-11-26).
- _Builder (2026-11-26):_ `batchFinished` is emitted when the cure ends; on an automatic station the unload follows, then `partFinished` per part (manual: all at the cure's end). `maxWait` is one cancellable timer on the first waiting part; when it fires, every waiting part (fewer than a batch) starts together. It works on perProduct batch stations too (lead part's cycle). The perBatch cure uses its own PRNG stream (`cure:<stationId>`), so other streams are untouched. `partFinished` is emitted on every station, so the exact event list in `line-mechanics.test.ts` gains one entry.

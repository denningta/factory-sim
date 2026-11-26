---
id: SF-0
epic: Shop floor
points: 3
priority: Must
sprint: 9
depends_on: []
builder_model: sonnet
owner: lead
issue: 171
---

# SF-0: Batch cure contract: schema v8 and engine events

**Story:** As the lead, I want the schema and the engine API for batch cure stations settled before the builders start, so that the autoclave engine, model and 3D stories build on one contract.

## Acceptance criteria

- [ ] Schema v8: the workstation params add `cycle`: `{ mode: 'perProduct' }` (today's behavior, the default) or `{ mode: 'perBatch', time: Duration }`, and an optional `maxWait: Duration` (start a partial batch this long after the first part waits). One upgrade function v7 → v8 sets `cycle: { mode: 'perProduct' }`. Tests: upgrade, round trip, rejects `maxWait` ≤ 0
- [ ] Engine public API (`line-api.ts`) adds the event types `batchStarted { equipmentId, partIds, endsAt? }`, `batchFinished { equipmentId, partIds }` and `partFinished { partId, equipmentId }` (done, waiting for downstream). Types and docs only; SF-6 emits them
- [ ] ADR-0010 amendment (new params on the workstation behavior, no new behavior) written as Proposed for product-owner sign-off
- [ ] Reference-model regression unchanged; `pnpm check` green

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-26):_ lead-owned (packages/schema and the sim-engine public API). Blocks SF-6, SF-7, SF-5.
- _Lead (2026-11-26):_ `cycle` is optional (absent = `perProduct`) instead of upgraded in, because library types stored in the API (EQ-3) aren't reached by the project upgrader; the v7 → v8 step bumps the version only. `batchStarted.endsAt` is always set (emitted when the cycle starts). See ADR-0017.

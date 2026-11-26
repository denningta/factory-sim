# ADR-0017: Batch cure cycle on workstations

- **Status:** Accepted (product owner, 2026-11-26, merged in #183)
- **Date:** 2026-11-26
- **Amends:** ADR-0010 (workstation parameters), ADR-0008 (new state events)

## Context

Sprint 9 adds an ASC autoclave (SF-6, SF-7). An autoclave loads a batch, cures it for a fixed time whatever the number or mix of parts, and unloads it all at once. If parts arrive slowly, it starts a part-full load rather than wait forever. The workstation behavior already batches (WS-3: `capacity`, `batchSize`). But it only starts full batches, takes its cycle time per (product, station) from the lead part, and emits nothing that marks a batch. The renderer can't show the load, the cure and the unload (SF-5), and it has no event for a finished part that is waiting for downstream room.

## Decision

1. **No new behavior.** The autoclave is a workstation with two optional parameters (schema v8):
   - `cycle`: `{ mode: 'perProduct' }` (the default when absent) or `{ mode: 'perBatch', time: Duration }`. With `perBatch`, one cure of `time` covers the whole batch, and the station needs no `cycleTimes` entries.
   - `maxWait` (seconds): a partial batch starts once the first waiting part has waited this long. Absent means full batches only, as before.
2. **Optional, not upgraded in.** Equipment types stored in the library (EQ-3) sit outside the project document, so the project upgrader can't reach them. Making the keys optional keeps every stored type valid. The v7 → v8 step only bumps the version.
3. **New events** in `LineEvent`:
   - `batchStarted { equipmentId, partIds, endsAt }`: when the cycle starts (after the load on an automatic station), only for batch stations (`batchSize` > 1 or `perBatch`)
   - `batchFinished { equipmentId, partIds }`
   - `partFinished { partId, equipmentId }`: for every finished part, which waits at the station until its next move. `PartInLine.last` can be `partFinished`.
4. **Unchanged:**
   - Load and unload stay once per batch.
   - `capacity` still counts every part at the station, waiting, in process or held.
   - Station-state precedence is the same. A batch that is still accumulating counts as `starved`.

## Consequences

- Positive: an autoclave, oven or curing rack is just data, which keeps ADR-0010's promise. Existing projects and stored types load unchanged. The renderer can place every part, and can animate a batch from events alone.
- Negative: a perBatch station ignores product-specific cure times. A product that needs a different cure needs its own station. Events grow by one `partFinished` per processed part.

## Alternatives considered

- A sixth `batch` behavior: duplicates most of the workstation (labor, techs, blocking) for two parameters.
- Requiring `cycle` and upgrading it in: breaks the stored library types (decision 2).
- Making the cure time scale with batch size: not how an autoclave works. A `perProduct` station with `batchSize` already covers batching where the product decides the time.

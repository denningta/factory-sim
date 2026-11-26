---
id: AN-1
epic: Analytics & KPIs
points: 5
priority: Must
sprint: 6
depends_on: [SE-4]
builder_model: sonnet
owner: builder
issue: 1
---

# AN-1: Throughput, WIP and lead time by product

**Story:** As a production manager, I want throughput, WIP and lead time by product so that I can judge whether the layout meets demand.

## Acceptance criteria

- [ ] Shows throughput (units/hour and units/shift), average WIP and average lead time, per product and in total
- [ ] Warm-up period excluded
- [ ] Updates live during a run; final values shown at the end
- [ ] Passes a Little's Law check (WIP ≈ throughput × lead time) within 5%

## Notes

- Engine already exposes `Run.stats()` (warm-up-free window); AN-1 is a web panel (`KpiPanel`, `kpis.ts`) polled every 200 ms and on session events, so the final values are exact.
- Throughput/shift = units/hr × the project's shift length. Lead time shown in minutes; "–" until a part exits.
- Not shown yet: the Bottleneck tile (AN-3).

- _UI-4 (2026-11-25):_ the live Throughput tile shows units/hr only; units/shift now appears on Results (`ResultsScreen`), not on the Simulate screen. Don't restore it there.

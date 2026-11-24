---
id: UI-6
epic: UI polish
points: 5
priority: Must
sprint: 8
depends_on: [UI-1, UI-2]
builder_model: sonnet
owner: builder
issue:
---

# UI-6: Results screen

**Story:** As a manufacturing engineer, I want one screen that summarizes a run and explains the bottleneck so that I can report the result and decide what to change.

## Acceptance criteria

- [ ] Layout follows wireframe 4. The header shows "Results · run N", run length, warm-up and seed, and whether the run is in progress (figures update live) or complete
- [ ] Four StatTiles: Throughput /shift vs demand /shift, Average WIP, Average lead time, and a **Little's Law check** that passes when WIP is within 10% of throughput × lead time. Test: passes on the reference model (`docs/reference-model/`)
- [ ] **By product** table: units/hr, units/shift, average WIP, average lead time, with product colour dots
- [ ] **Bottleneck** box: station name and working %, a sentence naming the stations upstream that are mostly blocked and downstream that are mostly starved, and **Open in Layout →**, which switches to Layout with that station selected
- [ ] **Station utilization** and **technician utilization** as stacked bars with legends (moved from Simulate; "Waiting for tech", not "Idle")
- [ ] Before any run: EmptyState "Run a simulation to see results" with a button that opens Simulate
- [ ] `results/` is in the no-`style` lint scope; screenshot in `docs/screenshots/UI-6/`

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ **the run session must outlive the Simulate tab.** Today `SimulateScreen` creates it in `useMemo`, so switching tabs drops it. Lift it into a small store (or `ProjectEditor`) shared by Simulate and Results. Session lifetime and playback otherwise stay as they are.
- _Lead:_ reuse `simulation/kpis.ts`, `utilization.ts` and `stationStatus.ts`; move `UtilizationPanel` here rather than duplicating it. Export CSV and Compare scenarios (shown in the wireframe) are out of scope.

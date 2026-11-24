---
id: UI-6
epic: UI polish
points: 5
priority: Must
sprint: 8
depends_on: [UI-1, UI-2, UI-9]
builder_model: sonnet
owner: builder
issue: 149
---

# UI-6: Results screen

**Story:** As a manufacturing engineer, I want one screen that summarizes a run and explains the bottleneck so that I can report the result and decide what to change.

## Acceptance criteria

- [ ] Layout follows wireframe 4. The header shows "Results · run N", run length, warm-up and seed, and whether the run is in progress (figures update live) or complete. "Run N" counts runs started in this session: Apply, Run simulation and Reset each start a new run (product owner, 2026-11-24)
- [ ] Four StatTiles: Throughput /shift vs demand /shift, Average WIP, Average lead time, and a **Little's Law check** that passes when WIP is within 5% of throughput × lead time, the same tolerance as AN-1 (product owner, 2026-11-24). Test: passes on the reference model (`docs/reference-model/`)
- [ ] **By product** table: units/hr, units/shift, average WIP, average lead time, with product colour dots
- [ ] **Bottleneck** box: station name and working %, a sentence naming the stations upstream that are mostly blocked and downstream that are mostly starved ("mostly" = more than 50% of the measured window; product owner, 2026-11-24), and **Open in Layout →**, which switches to Layout with that station selected
- [ ] **Station utilization** and **technician utilization** as stacked bars with legends, sorted by working %, highest first (moved from Simulate; "Waiting for tech", not "Idle") (product owner, 2026-11-24)
- [ ] If the model changes after a run, Results shows "The model changed since this run" with a button to run again; the figures stay visible (product owner, 2026-11-24)
- [ ] Before any run: EmptyState "Run a simulation to see results" with a button that opens Simulate
- [ ] `results/` is in the no-`style` lint scope; screenshot in `docs/screenshots/UI-6/`

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ **the run session must outlive the Simulate tab.** Today `SimulateScreen` creates it in `useMemo`, so switching tabs drops it. Lift it into a web-only Zustand store (`simulation/sessionStore.ts`) that both screens read; no engine change. Session lifetime and playback otherwise stay as they are.
- _Lead:_ reuse `simulation/kpis.ts`, `utilization.ts` and `stationStatus.ts`; move `UtilizationPanel` here rather than duplicating it. Export CSV and Compare scenarios (shown in the wireframe) are out of scope.
- _Lead (2026-11-24):_ **redesign toward the control-room look** (product owner, 2026-11-24): see [`docs/wireframes/reference/`](../wireframes/reference/README.md). Load the `frontend-design` skill (and `dataviz` for charts, tiles, legends, bars) and add a Design section to the PR (builder role). Colours come from the active theme (UI-9).

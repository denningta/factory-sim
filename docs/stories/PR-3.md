---
id: PR-3
epic: Products & routings
points: 5
priority: Must
sprint: 3
depends_on: [PR-2]
builder_model: sonnet
owner: builder
issue: 25
---

# PR-3: Enter cycle time per product per station

**Story:** As a manufacturing engineer, I want to enter cycle time per product per station so that work content differences between products are modeled.

## Acceptance criteria

- [ ] Editable product × station grid, filled only where the routing uses that station
- [ ] Each cell takes a fixed time (distributions per cell are WS-2's scope)
- [ ] Missing cycle times are flagged before a run
- [ ] Import from CSV/paste from Excel

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **AC change (product owner, 2026-11-22):** "or a distribution" moved to WS-2, so PR-3 ships complete with fixed times. Build the cell so WS-2 can add other `time.kind`s.
- Cycle times exist in the schema keyed by (product, station) with `time: { kind: 'fixed', value }` (seconds). CSV/paste import parses into the same schema (seconds; accept mm:ss as display input).
- From the PR-1 review (#81): move `cycleTimes` into the editor store and the LE-3 undo snapshot, so undoing a product delete also restores its cycle times.

### Builder notes (PR-3)

- `cycleTimes` now live in the editor store, the undo snapshot and `loadDocument`; `ProjectEditor` saves straight from the store. Deleting a product or a station, or editing a routing so a station is no longer used, drops the matching cycle times (the schema rejects references to unknown products or stations, and the grid is "filled only where the routing uses the station"). Undo restores them.
- A cell is a text input taking seconds or `mm:ss` / `h:mm:ss`, stored as `time: { kind: 'fixed', value }` in seconds. Valid text commits as you type; an empty cell clears the time; invalid text shows an error and never reaches the store. `TimeCell` is the one place WS-2 extends for other `time.kind`s; the grid, store keying and missing-time check only care whether a cell has a time.
- Missing times: `missingCycleTimes()` lists routing (product, station) pairs with no entry; `preRunIssues()` reports them as `missing_cycle_times` (the SIM run button disables on any issue), and empty cells are highlighted.
- Import: header row of station names (matched by name, case-insensitive, workstations only), first column part numbers; tab (Excel paste) or comma (CSV) is auto-detected. Skipped cells (unknown part/station, station not in that product's routing, bad time) are listed after the import; the rest still applies as one undo step.
- Screenshots: `docs/screenshots/PR-3/`.

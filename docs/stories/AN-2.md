---
id: AN-2
epic: Analytics & KPIs
points: 5
priority: Must
sprint: 6
depends_on: [SE-4, TE-2]
builder_model: sonnet
owner: builder
issue: 2
---

# AN-2: Utilization by station and by tech

**Story:** As a manufacturing engineer, I want utilization by station and by tech so that I can balance the work.

## Acceptance criteria

- [ ] Station time split into working, starved, blocked and idle %
- [ ] Tech time split into working, walking and idle %
- [ ] Shown as a sortable table and stacked bars

## Notes

- No Results screen exists yet (AN-3 / later), so the utilization panel sits in the Simulate screen's right column under the live KPIs; the sidebar grew 240 → 300px to fit four state columns. It moves with the KPI panel when a Results screen lands.
- The engine already reports per-state fractions (`RunStats.stations/techs`, warm-up excluded); the web layer only converts to % and sorts. Stations are workstations; the figures update live like the KPIs.
- Sort: clicking a header sorts descending first (name: A–Z), a second click reverses; unsorted = layout order.

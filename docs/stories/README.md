# Stories

One file per story, generated from `docs/planning/mvp-backlog.xlsx` by `scripts/import-backlog.py`.
GitHub Issues are the live status; these files are the spec. Acceptance criteria change only with product-owner approval.

## Sprint 1: Foundation: one-command deploy, simulation engine core, to-scale floor (32 pts)

| ID              | Epic              | Pts | Priority | Depends on |
| --------------- | ----------------- | --- | -------- | ---------- |
| [PL-1](PL-1.md) | Platform          | 5   | Must     | —          |
| [PL-2](PL-2.md) | Platform          | 3   | Must     | PL-1       |
| [PL-3](PL-3.md) | Platform          | 3   | Must     | —          |
| [PL-4](PL-4.md) | Platform          | 3   | Must     | —          |
| [PL-5](PL-5.md) | Platform          | 3   | Must     | —          |
| [LE-1](LE-1.md) | Layout editor     | 5   | Must     | PL-5       |
| [SE-1](SE-1.md) | Simulation engine | 8   | Must     | —          |
| [PL-7](PL-7.md) | Platform          | 2   | Must     | PL-1, PL-2 |

## Sprint 2: Build a layout: place and edit equipment, sign in, save projects (34 pts)

| ID              | Epic                 | Pts | Priority | Depends on       |
| --------------- | -------------------- | --- | -------- | ---------------- |
| [PL-6](PL-6.md) | Platform             | 5   | Must     | PL-1             |
| [LE-2](LE-2.md) | Layout editor        | 5   | Must     | LE-1, EQ-1       |
| [LE-3](LE-3.md) | Layout editor        | 3   | Must     | LE-2             |
| [LE-4](LE-4.md) | Layout editor        | 3   | Must     | LE-1             |
| [EQ-1](EQ-1.md) | Equipment library    | 5   | Must     | —                |
| [EQ-2](EQ-2.md) | Equipment library    | 3   | Must     | EQ-1             |
| [WS-1](WS-1.md) | Workstation config   | 3   | Must     | LE-2             |
| [SC-1](SC-1.md) | Scenarios & projects | 5   | Must     | PL-2, PL-3, PL-6 |
| [PL-8](PL-8.md) | Platform             | 2   | Must     | PL-1, PL-6       |

## Sprint 3: Mixed-model data: products, routings, cycle times, connections, buffers (27 pts)

| ID              | Epic                | Pts | Priority | Depends on |
| --------------- | ------------------- | --- | -------- | ---------- |
| [PR-1](PR-1.md) | Products & routings | 3   | Must     | SC-1       |
| [PR-2](PR-2.md) | Products & routings | 8   | Must     | PR-1, EQ-1 |
| [PR-3](PR-3.md) | Products & routings | 5   | Must     | PR-2       |
| [FL-1](FL-1.md) | Flow & connections  | 5   | Must     | LE-2       |
| [FL-2](FL-2.md) | Flow & connections  | 3   | Must     | FL-1       |
| [PL-9](PL-9.md) | Platform            | 3   | Must     | PL-6       |

## Sprint 4: Configure the line: distributions, techs, release rules, routing at splits (33 pts)

| ID              | Epic                | Pts | Priority | Depends on       |
| --------------- | ------------------- | --- | -------- | ---------------- |
| [SE-6](SE-6.md) | Simulation engine   | 8   | Must     | SE-1, PR-3, FL-2 |
| [PR-4](PR-4.md) | Products & routings | 5   | Must     | PR-1, SE-6       |
| [WS-2](WS-2.md) | Workstation config  | 5   | Must     | PR-3             |
| [WS-3](WS-3.md) | Workstation config  | 3   | Must     | SE-1, SE-6       |
| [TE-1](TE-1.md) | Technicians         | 5   | Must     | WS-1             |
| [FL-3](FL-3.md) | Flow & connections  | 5   | Must     | PR-2, FL-1, SE-6 |
| [FL-4](FL-4.md) | Flow & connections  | 2   | Should   | FL-1, SE-6       |

## Sprint 5: Run it: animation, run controls, walking techs, pre-run checks (24 pts)

| ID              | Epic              | Pts | Priority | Depends on       |
| --------------- | ----------------- | --- | -------- | ---------------- |
| [TE-2](TE-2.md) | Technicians       | 5   | Must     | TE-1, SE-3       |
| [SE-2](SE-2.md) | Simulation engine | 5   | Must     | SE-1             |
| [SE-3](SE-3.md) | Simulation engine | 8   | Must     | SE-1, PL-5       |
| [SE-4](SE-4.md) | Simulation engine | 3   | Must     | SE-1             |
| [SE-5](SE-5.md) | Simulation engine | 3   | Must     | PR-3, TE-1, FL-3 |

## Sprint 6: See the bottleneck + extend: KPIs, utilization, custom equipment (MVP release) (27 pts)

| ID              | Epic              | Pts | Priority | Depends on |
| --------------- | ----------------- | --- | -------- | ---------- |
| [LE-5](LE-5.md) | Layout editor     | 3   | Should   | LE-2       |
| [EQ-3](EQ-3.md) | Equipment library | 8   | Must     | EQ-1, WS-1 |
| [EQ-4](EQ-4.md) | Equipment library | 3   | Should   | EQ-3, FL-1 |
| [AN-1](AN-1.md) | Analytics & KPIs  | 5   | Must     | SE-4       |
| [AN-2](AN-2.md) | Analytics & KPIs  | 5   | Must     | SE-4, TE-2 |
| [AN-3](AN-3.md) | Analytics & KPIs  | 3   | Must     | AN-2, SE-3 |
| [SE-7](SE-7.md) | Simulation engine | 2   | Must     | SE-4       |
| [SE-8](SE-8.md) | Simulation engine | 2   | Should   | SE-2       |
| [TE-3](TE-3.md) | Technicians       | 3   | Should   | TE-2       |
| [LE-6](LE-6.md) | Layout editor     | 1   | Should   | LE-5       |

## Sprint 7: Hardening: post-MVP follow-ups (12 pts)

| ID              | Epic                 | Pts | Priority | Depends on |
| --------------- | -------------------- | --- | -------- | ---------- |
| [SE-9](SE-9.md) | Simulation engine    | 2   | Should   | SE-1       |
| [PR-5](PR-5.md) | Products & routings  | 2   | Should   | PR-4       |
| [EQ-5](EQ-5.md) | Equipment library    | 3   | Should   | EQ-2       |
| [WS-4](WS-4.md) | Workstation config   | 1   | Should   | WS-3, TE-1 |
| [SC-2](SC-2.md) | Scenarios & projects | 2   | Should   | SC-1       |
| [AN-4](AN-4.md) | Analytics & KPIs     | 2   | Should   | AN-3       |

## Sprint 8: Make it obvious: UI polish, dark control-room theme, station status in 3D, extensible models (35 pts)

| ID              | Epic      | Pts | Priority | Depends on       |
| --------------- | --------- | --- | -------- | ---------------- |
| [UI-1](UI-1.md) | UI polish | 5   | Must     | —                |
| [UI-7](UI-7.md) | UI polish | 5   | Must     | EQ-5             |
| [UI-9](UI-9.md) | UI polish | 4   | Must     | UI-1             |
| [UI-2](UI-2.md) | UI polish | 3   | Must     | UI-1, UI-9       |
| [UI-6](UI-6.md) | UI polish | 5   | Must     | UI-1, UI-2, UI-9 |
| [UI-5](UI-5.md) | UI polish | 5   | Must     | UI-7, AN-4, UI-9 |
| [UI-3](UI-3.md) | UI polish | 5   | Must     | UI-1, UI-9       |
| [UI-4](UI-4.md) | UI polish | 3   | Must     | UI-1, UI-6       |

Order (lead, 2026-11-24): UI-1 ∥ UI-7 → UI-9 → UI-2 ∥ UI-5 → UI-6 ∥ UI-3 → UI-4. UI-3 waits for UI-7 (both change `layout/`), and UI-4 and UI-5 don't run together (both change `simulation/`). Styling approach: ADR-0016 (dark by default, light toggle). Visual target (product owner, 2026-11-24): [`docs/wireframes/reference/`](../wireframes/reference/README.md); UI stories load the `frontend-design` skill (and `dataviz` for charts). Prototype reference files: [`docs/wireframes/prototype/`](../wireframes/prototype/README.md). Decided in planning (product owner, 2026-11-23): per-type 3D models via the optional `model` key (ADR-0015, merged in #138); the engine's `idle` is shown as "Waiting for tech"; utilization moves from Simulate to Results.

## Sprint 9: Control-room scene and trends (10 pts)

| ID                | Epic      | Pts | Priority | Depends on |
| ----------------- | --------- | --- | -------- | ---------- |
| [UI-8](UI-8.md)   | UI polish | 5   | Should   | UI-7, UI-9 |
| [UI-10](UI-10.md) | UI polish | 5   | Must     | UI-6, UI-9 |

Moved or added on 2026-11-24 (product owner): UI-8 moves from sprint 8; UI-10 adds trend charts with uPlot.

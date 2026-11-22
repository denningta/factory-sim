# Stories

One file per story, generated from `docs/planning/mvp-backlog.xlsx` by `scripts/import-backlog.py`.
GitHub Issues are the live status; these files are the spec. Acceptance criteria change only with product-owner approval.

## Sprint 1: Foundation: one-command deploy, simulation engine core, to-scale floor (30 pts)

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

## Sprint 2: Build a layout: place and edit equipment, sign in, save projects (32 pts)

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

## Sprint 3: Mixed-model data: products, routings, cycle times, connections, buffers (24 pts)

| ID              | Epic                | Pts | Priority | Depends on |
| --------------- | ------------------- | --- | -------- | ---------- |
| [PR-1](PR-1.md) | Products & routings | 3   | Must     | SC-1       |
| [PR-2](PR-2.md) | Products & routings | 8   | Must     | PR-1, EQ-1 |
| [PR-3](PR-3.md) | Products & routings | 5   | Must     | PR-2       |
| [FL-1](FL-1.md) | Flow & connections  | 5   | Must     | LE-2       |
| [FL-2](FL-2.md) | Flow & connections  | 3   | Must     | FL-1       |

## Sprint 4: Configure the line: distributions, techs, release rules, routing at splits (25 pts)

| ID              | Epic                | Pts | Priority | Depends on |
| --------------- | ------------------- | --- | -------- | ---------- |
| [PR-4](PR-4.md) | Products & routings | 5   | Must     | PR-1       |
| [WS-2](WS-2.md) | Workstation config  | 5   | Must     | PR-3       |
| [WS-3](WS-3.md) | Workstation config  | 3   | Must     | SE-1       |
| [TE-1](TE-1.md) | Technicians         | 5   | Must     | WS-1       |
| [FL-3](FL-3.md) | Flow & connections  | 5   | Must     | PR-2, FL-1 |
| [FL-4](FL-4.md) | Flow & connections  | 2   | Should   | FL-1       |

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

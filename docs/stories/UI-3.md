---
id: UI-3
epic: UI polish
points: 5
priority: Must
sprint: 8
depends_on: [UI-1, UI-9]
builder_model: sonnet
owner: builder
issue: 146
---

# UI-3: Layout screen organized by task

**Story:** As a manufacturing engineer, I want the layout screen to show only what fits what I am doing, grouped by purpose, so that I can find a setting without scrolling through unrelated ones.

## Acceptance criteria

- [ ] **Library (left):** a search box filters types by name and description; types are grouped under "Base types" and "My equipment"; the 3D preview stays below. Test: typing filters, clearing restores
- [ ] **Right panel by selection:** nothing selected → Floor settings and Technicians; equipment selected → Properties in collapsible Sections **General** (name, type, model), **Size & position**, **Process** (capacity, batch size, labor, cycle-time summary with a link to Products & routings), **Staffing** (assigned techs); connection selected → **Buffer & transfer**. Each section remembers whether it is open for the session
- [ ] **Toolbar** grouped as View (3D/2D, Zoom to fit) · Edit (Undo, Redo, Delete) · Connect · Clearance, with keyboard shortcuts in tooltips
- [ ] **Status bar:** units · snap · selected object · overlap count. Clicking the overlap count selects the first overlapping object
- [ ] Every empty state gives the next action as one line, using EmptyState (e.g. empty floor: "Drag a type from the library onto the floor"; no techs: "Add a technician, then assign stations")
- [ ] `layout/`, `equipment/` and `technicians/` join the no-`style` lint scope; existing LE/EQ/WS/TE tests pass (selector updates only)
- [ ] Screenshots in `docs/screenshots/UI-3/`: nothing selected, workstation selected, connection selected

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ files: `Editor.tsx`, `layout/PropertiesPanel.tsx`, `layout/FloorPanel.tsx`, `layout/ViewToolbar.tsx`, `equipment/LibrarySection.tsx`, `technicians/TechniciansPanel.tsx`. Prototype reference: the inspector's `<details>` sections ([`docs/wireframes/prototype/inspector.js`](../wireframes/prototype/inspector.js), styles under `#inspector` in `prototype.css`).
- _Lead:_ dispatched after UI-7: both change `layout/` (`EquipmentLayer.tsx`, `equipmentGroups.ts`).
- _Lead:_ the **model** field in General is read-only here (the type's model, ADR-0015); choosing a model belongs to the type editor (UI-7).
- _Lead (2026-11-24):_ **redesign toward the control-room look** (product owner, 2026-11-24): see [`docs/wireframes/reference/`](../wireframes/reference/README.md). Load the `frontend-design` skill (and `dataviz` for charts, tiles, legends, bars) and add a Design section to the PR (builder role). Colours come from the active theme (UI-9).

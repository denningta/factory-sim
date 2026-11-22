---
id: PR-1
epic: Products & routings
points: 3
priority: Must
sprint: 3
depends_on: [SC-1]
builder_model: sonnet
owner: builder
issue: 23
---

# PR-1: Define the end items built on my line

**Story:** As a manufacturing engineer, I want to define the end items built on my line so that I can model a mixed-model line.

## Acceptance criteria

- [ ] Create, edit and delete products with part number, name and display color
- [ ] Part numbers must be unique
- [ ] A run needs at least one product

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Run gate:** there is no run button yet, so AC3 is the pure `preRunIssues(project)` in `apps/web/src/products/` returning `[{ code: 'no_products', message }]`. The Products screen shows it; the run button (SIM) should disable on a non-empty result. Deleting the last product is allowed.
- **Part numbers** are unique ignoring case and surrounding space (the schema trims; the store also lowercases to compare). A whitespace-only name is rejected in the store, as the schema allows it.
- **Persistence:** products are in undo history, `loadDocument` and autosave. Autosave drops cycle times of deleted products so the saved document stays valid.
- **UI scope:** the End items column of wireframe 2 only, reached through a Layout / Products switch in the project header. Routing (PR-2), cycle-time matrix (PR-3) and demand (PR-4) are not built.

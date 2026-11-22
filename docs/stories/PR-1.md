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

- Products already exist in the schema (`id, partNumber, name, color, routing`); part-number uniqueness is enforced there (trimmed). AC3 ('a run needs at least one product'): there's no run button until SE-2, so add a pure `preRunIssues(project)` in `apps/web` returning `[{ code: 'no_products', message }]`. SE-5 extends it into the full pre-run check.

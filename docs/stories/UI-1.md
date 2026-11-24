---
id: UI-1
epic: UI polish
points: 5
priority: Must
sprint: 8
depends_on: []
builder_model: sonnet
owner: builder
issue:
---

# UI-1: Design tokens and base components

**Story:** As a manufacturing engineer, I want every screen to share one clear visual language so that I can tell at a glance what is a heading, an input, an action or a status.

## Acceptance criteria

- [ ] One token module (`apps/web/src/ui/tokens.ts`) defines surfaces, text, muted text, border, accent, danger, spacing, radius and type scale, plus the state colours: working green, starved yellow, blocked red, waiting-for-tech gray, tech walking purple. Each state has a **strong** value (lights, outlines, text) and a **tint** (bars, fills). Tokens are applied as CSS custom properties on the root, and 3D code reads the same module
- [ ] Base components in `apps/web/src/ui/`: Button (primary, secondary, danger, disabled), Field (label, input, unit suffix, error text, wired `id`/`aria-describedby`), Section (heading, optional description, optionally collapsible), Tabs, StatTile (label, value, unit, sub-line), Legend, Badge, EmptyState. Each has a test for its accessible role and name
- [ ] The sign-in, account, project list and Products & routings screens use the tokens and components: no hand-written font, colour, border or spacing in `style=` there
- [ ] A lint rule forbids `style` on DOM elements in the migrated directories (`ui/`, `auth/`, `projects/`, `products/`). Computed geometry (bar widths, product colour swatches) is allowed only with a disable comment that explains it. Later stories add their directories
- [ ] `STATE_COLORS` (`simulation/stationStatus.ts`), the utilization bars and every legend take their colours from the tokens. Test: they equal the token values
- [ ] Before/after screenshots of the migrated screens in `docs/screenshots/UI-1/`

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ sprint 8 is UI polish (product owner, 2026-11-23). Visual reference: [`docs/wireframes/prototype/prototype.css`](../wireframes/prototype/prototype.css) (palette, `.kpi`, `.legend`, `.tabs`, `label.f`, `#inspector details`) and wireframes 1–4. Starting palette (light): bg `#eef0f3`, surface `#ffffff`, surface-2 `#f3f5f8`, text `#1b1f24`, muted `#5b6470`, border `#d5dae1`, accent `#2f6fde`; states working `#1d9a55`, starved `#d9a21b`, blocked `#d43a3a`, waiting `#8a94a3`, walking `#7b2fbf`. Tints come from wireframe 4 (pale green/yellow/red/gray fills with the strong colour as outline).
- _Lead:_ **styling approach: ADR-0016 (Design tokens and CSS Modules)**, landed by the lead before dispatch. Plain CSS custom properties plus CSS Modules (built into Vite), no new dependency. Tokens live in TS and are injected as CSS variables at startup, so three.js materials and CSS share one source and jsdom tests can assert values. Dark mode is out of scope, but keep the tokens in one object per theme so it is cheap later.
- _Lead:_ **lint rule without a new plugin:** core `no-restricted-syntax` with `JSXOpeningElement[name.name=/^[a-z]/] > JSXAttribute[name.name='style']`, scoped to the migrated directories. `eslint.config.js` is shared config, so call it out in the PR.
- _Lead:_ point the colour list in `docs/wireframes/README.md` at `tokens.ts`.

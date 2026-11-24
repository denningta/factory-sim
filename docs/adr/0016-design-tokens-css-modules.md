# ADR-0016: Design tokens in TypeScript, styling with CSS Modules

- **Status:** Proposed (needs product-owner sign-off)
- **Date:** 2026-11-24
- **Amends:** ADR-0002 (adds the styling approach to the frontend stack)

## Context

Sprint 8 (UI polish) restyles every screen. Today the web app styles components with inline `style={{…}}` objects, with colours repeated across files. Station-state colours are defined in `simulation/stationStatus.ts` and again in the utilization bars, and three.js materials read their own hex values. The same palette has to reach the DOM and the 3D scene, and tests need to assert colours without a browser.

## Decision

1. **One token module**, `apps/web/src/ui/tokens.ts`: surfaces, text, border, accent, danger, spacing, radius, type scale, and the station and tech state colours (each with a strong value and a tint). It is plain TypeScript data, one object per theme (only light ships now).
2. **CSS custom properties from the tokens.** At startup the app writes the tokens to `:root` as `--…` variables. CSS reads the variables; three.js materials and tests import `tokens.ts` directly. Neither copies a value by hand.
3. **CSS Modules** (built into Vite) for component styles. No CSS-in-JS runtime, utility framework or other new dependency.
4. **Base components** in `apps/web/src/ui/` (Button, Field, Section, Tabs, StatTile, Legend, Badge, EmptyState). Screens compose them.
5. **No inline `style` on DOM elements** in migrated directories, enforced by ESLint core `no-restricted-syntax` (no plugin). Computed geometry (bar widths, product colour swatches) stays inline with a disable comment that says why. Each sprint 8 screen story adds its directory to the rule.

## Consequences

- Positive: one source for every colour in the DOM and the 3D scene. jsdom tests can assert token values. Restyling a screen doesn't touch logic. A dark theme later is a second token object.
- Negative: a migration across all screens, spread over UI-1 to UI-6. Until a directory is migrated, inline styles and tokens coexist. CSS Modules add class names to tests that query by class, so tests should keep querying by role and label.

## Alternatives considered

- Tailwind or another utility framework: fast to write, but a new dependency and build step, and three.js still needs the palette in TS.
- CSS-in-JS (styled-components, vanilla-extract): co-located styles, but a runtime or build plugin, and a second token format.
- Keep inline styles with shared constants: no tooling, but no pseudo-classes or media queries, and screens stay hard to read.

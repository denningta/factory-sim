# ADR-0012: Testing strategy

- **Status:** Accepted (signed off 2026-11-21)
- **Date:** 2026-11-21

## Context

AI agents write most of the code; tests are how we trust it.

## Decision

Vitest for unit tests; Playwright for end-to-end tests; the reference model (5 stations, 2 products, known results) runs in CI as a regression test; engine coverage >= 90%.

## Consequences

- Positive: Every acceptance criterion is checked automatically; regressions in sim results are caught.
- Negative: CI time grows; e2e tests need care to stay stable.

## Alternatives considered

Manual testing (doesn't scale with several agents).

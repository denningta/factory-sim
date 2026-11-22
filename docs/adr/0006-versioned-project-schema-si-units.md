# ADR-0006: Versioned project schema, SI units

- **Status:** Accepted (signed off 2026-11-21)
- **Date:** 2026-11-21

## Context

Projects saved today must open in future releases; layouts must stay to scale regardless of display units.

## Decision

Project document defined with zod in packages/schema, carrying schemaVersion and an upgrade function per version. All lengths stored in meters and all times in seconds; ft/min are display-only.

## Consequences

- Positive: Safe upgrades, one validation path for web and API, no rounding drift from unit switching.
- Negative: Every breaking change needs an upgrade step and a test.

## Alternatives considered

Unversioned JSON (breaks old projects); storing user units (conversion bugs).

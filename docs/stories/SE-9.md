---
id: SE-9
epic: Simulation engine
points: 2
priority: Should
sprint: 7
depends_on: [SE-1]
builder_model: sonnet
owner: builder
issue: 111
---

# SE-9: Reliable engine and web tests

**Story:** As the team, I want the test suite to pass reliably so that CI failures always mean a real problem.

## Acceptance criteria

- [ ] `rng.test.ts` "exponential(mean)…" passes under parallel `pnpm check` (lower the sample count or set a per-test timeout, keeping the statistical check meaningful)
- [ ] The SE-2/AN-1 run-to-end web tests use test-level timeouts, not only `waitFor` timeouts, so they don't flake under load
- [ ] Engine polish from #50: `log` golden inputs include `1.4` and `2.8`; `createTimeWeighted(initial)` rejects non-finite `initial`; the `rng.test.ts` describe title no longer says splitmix32

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ covers #111 and #50 (put `Closes #50` in the PR too). Engine internals only; no public API change. Coverage stays ≥ 90%.

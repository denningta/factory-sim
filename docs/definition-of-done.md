# Definition of Done

Applies to every story PR. (Lead docs-only PRs, such as story notes or runbook wording, skip the reviewer pass; contract, CI, `.claude` and code PRs don't.) A story PR is not ready for the product owner until all are true:

- [ ] code reviewed and merged (by the lead under its merge rule, or by the product owner where reserved)
- [ ] automated tests pass
- [ ] acceptance criteria verified
- [ ] works in the Docker Compose build
- [ ] no new critical bugs
- [ ] docs updated if behavior changed
- [ ] Lint, type check and unit tests pass locally and in CI
- [ ] PR body maps each acceptance criterion to the test or check that verifies it

## Definition of Ready

A story is ready for a sprint when it has acceptance criteria, an estimate, no blocking dependencies and the team understands it.

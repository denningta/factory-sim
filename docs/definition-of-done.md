# Definition of Done

Applies to every story PR. (Lead docs-only PRs, such as story notes or runbook wording, skip the reviewer pass; contract, CI, `.claude` and code PRs don't.) A story PR is not ready for the product owner until all are true:

- [ ] code reviewed and merged
- [ ] automated tests pass
- [ ] acceptance criteria verified
- [ ] works in the Docker Compose build
- [ ] no new critical bugs
- [ ] docs updated if behavior changed
- [ ] Lint, type check and unit tests pass locally and in CI
- [ ] PR body maps each acceptance criterion to the test or check that verifies it
- [ ] UI changes: screenshots made with `pnpm screenshot docs/screenshots/<ID>/shots.json` (the shared tool; no home-made harness), committed with their `shots.json`, embedded in the PR and pinned to a commit SHA. Unless the story says otherwise they show the real app on the reference model (`docs/reference-model/model.json`), at 1280×800, in **both** dark and light, and any run is past warm-up (e.g. `{ "click": "text=Run to end" }`). Every screen the story changes is covered.

## Definition of Ready

A story is ready for a sprint when it has acceptance criteria, an estimate, no blocking dependencies and the team understands it.

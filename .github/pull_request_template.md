## Story

Closes #<issue> · `docs/stories/<ID>.md`

<!-- One or two sentences: what changed and why. -->

## Acceptance criteria → verification

| #   | Acceptance criterion | How it is verified (test name / file / manual check) |
| --- | -------------------- | ---------------------------------------------------- |
| 1   |                      |                                                      |

## Definition of Done

- [ ] Every acceptance criterion has an automated test that fails without this change
- [ ] `pnpm check` passes locally; CI is green
- [ ] Works in the Docker Compose build (if deploy/API/DB touched)
- [ ] No changes to lead-owned areas (schema, sim-engine public API, ADRs, CI, .claude) unless agreed with the lead
- [ ] Docs updated if behavior changed
- [ ] Screenshots/GIF attached for UI changes

## Notes and assumptions

## Follow-ups (out of scope)

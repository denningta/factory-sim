---
description: Review a PR against its story's acceptance criteria, ADRs and Definition of Done, then comment. Usage: /review-pr <number>
argument-hint: <pr-number>
---

Review PR **#$ARGUMENTS**. You are the read-only reviewer (`.claude/agents/reviewer.md`). Never edit, commit, push or merge.

1. `gh pr view $ARGUMENTS --json title,body,headRefName,files,commits,closingIssuesReferences` and `gh pr checks $ARGUMENTS`.
2. Find the story ID from the title/branch and read `docs/stories/<ID>.md`, the linked issue, the ADRs it touches and `docs/definition-of-done.md`.
3. `gh pr diff $ARGUMENTS` and read every changed file in full context (use Read/Grep on the main checkout plus the diff; for running tests, `git fetch origin <branch>` and run in a temporary worktree: `git worktree add /tmp/review-$ARGUMENTS origin/<branch>`, `pnpm install --frozen-lockfile`, `pnpm check`, and remove it afterwards with `git worktree remove /tmp/review-$ARGUMENTS`).
4. Check, in order:
   - **Each acceptance criterion**: implemented? Verified by a test that would fail without the change? Make a table: criterion | verdict | evidence (file:line / test name).
   - **Correctness**: logic errors, edge cases, error handling, determinism (sim-engine), SI units, validation.
   - **Scope and ownership**: only the story's scope; no changes to lead-owned areas by a builder; no unrelated refactors.
   - **ADRs and CLAUDE.md conventions**.
   - **Definition of Done**: CI green, Compose build works when relevant, docs updated.
   - **Tests first**: there's a `<ID>: add failing tests…` commit before the implementation, and its tests fail at that commit (check out that commit in the temporary worktree and run them). If it's missing, that's **blocking** for stories dispatched after this rule landed; earlier ones get a note.
   - **UI stories**: screenshots are embedded and match the wireframe regions (left library, centre viewport, right properties). A missing screenshot is blocking.
5. Post the review **as a comment** (all agents share one GitHub account, so formal approvals aren't possible):
   `gh pr comment $ARGUMENTS --body-file <file>` with: the criteria table, blocking issues (file:line, problem, suggested fix), non-blocking nits, and a final line `**Verdict: APPROVE**` or `**Verdict: REQUEST CHANGES**`.
6. Reply to the lead with the verdict and a 2–3 line summary suitable for the product owner.

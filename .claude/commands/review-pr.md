---
description: Review a PR against its story's acceptance criteria, ADRs and Definition of Done, then comment. Usage: /review-pr <number>
argument-hint: <pr-number>
---

Review PR **#$ARGUMENTS**. You are the read-only reviewer (`.claude/agents/reviewer.md`). Never edit, commit, push or merge.

0. **Re-review?** If this PR already has a review comment from you, take its `Reviewed at <sha>` line (from your context, or from the PR's last review comment if your context was cleared). Review only `git diff <sha>..HEAD`, re-run only the affected packages' tests, and post a short update comment (verdict per earlier point). Skip steps 1–4 for unchanged parts. Follow the token budget in `.claude/agents/reviewer.md`.
1. `gh pr view $ARGUMENTS --json title,body,headRefName,files,commits,closingIssuesReferences` and `gh pr checks $ARGUMENTS`.
2. Find the story ID from the title/branch and read `docs/stories/<ID>.md`, the linked issue, the ADRs it touches and `docs/definition-of-done.md`.
3. `gh pr diff $ARGUMENTS --name-only` first, then read the changed files in their relevant ranges (Read with offset/limit, Grep on the main checkout). Don't read unrelated whole modules. To run tests, `git fetch origin <branch>` and use a temporary worktree: `git worktree add /tmp/review-$ARGUMENTS origin/<branch>`, `pnpm install --frozen-lockfile`, then the **affected packages' tests** (`pnpm --filter <pkg> test 2>&1 | tail -30`) plus lint and typecheck. CI already ran the full suite. Remove the worktree afterwards with `git worktree remove /tmp/review-$ARGUMENTS`.
4. Check, in order:
   - **Each acceptance criterion**: implemented? Verified by a test that would fail without the change? Make a table: criterion | verdict | evidence (file:line / test name).
   - **Correctness**: logic errors, edge cases, error handling, determinism (sim-engine), SI units, validation.
   - **Scope and ownership**: only the story's scope; no changes to lead-owned areas by a builder; no unrelated refactors.
   - **ADRs and CLAUDE.md conventions**.
   - **Definition of Done**: CI green, Compose build works when relevant, docs updated.
   - **Tests first**: there's a `<ID>: add failing tests…` commit before the implementation. At that commit (check it out in the temporary worktree), lint and typecheck pass, and the new tests fail **on their assertions or on a stub's "not implemented" error**, not on import or wiring errors. If the commit is missing, that's **blocking**. Exempt: EQ-1 and PL-6, which started before this rule (note it instead).
   - **UI stories** (anything that changes what `apps/web` renders or its layout): screenshots are embedded, pinned to a commit SHA, and match the regions of the story's wireframe in `docs/wireframes/`. A missing screenshot is blocking.
5. Post the review **as a comment** (all agents share one GitHub account, so formal approvals aren't possible):
   `gh pr comment $ARGUMENTS --body-file <file>`. Its first line is `Reviewed at <head sha>`, then the criteria table, blocking issues (file:line, problem, suggested fix), non-blocking nits, and a final line `**Verdict: APPROVE**` or `**Verdict: REQUEST CHANGES**`.
6. Reply to the lead with the verdict and a 2–3 line summary suitable for the product owner.

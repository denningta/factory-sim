---
description: Implement one user story end to end (tests first) and open a PR. Usage: /implement-story <ID>
argument-hint: <story-id e.g. PL-1>
---

Implement story **$ARGUMENTS**. You are a builder; follow `.claude/agents/builder.md` and `CLAUDE.md`.

1. **Orient**
   - Confirm you are on branch `story/$ARGUMENTS` in your own worktree (`git branch --show-current`). If not, stop and tell the lead.
   - `pnpm install` if `node_modules` is missing. `git fetch origin && git rebase origin/main`.
   - Read `docs/stories/$ARGUMENTS.md`, its GitHub issue (`gh issue view <issue number from frontmatter>` or `gh issue list --search "$ARGUMENTS:" --state open`), the ADRs it touches, `docs/definition-of-done.md`, and the related wireframe if it is a UI story.
   - Check that every `depends_on` story is merged. If not, stop and report.
2. **Plan**: write a short plan in your reply: each acceptance criterion → how you'll implement it → which test proves it. List the files you expect to touch. If any are lead-owned (`packages/schema`, sim-engine public API, `docs/adr`, `.github`, `.claude`, root configs), **stop and report to the lead** with the exact change you need.
3. **Tests first**: write failing tests for each acceptance criterion (Vitest; Playwright for UI flows once set up). Run them and confirm they fail for the right reason.
4. **Implement** the smallest change that makes them pass. Follow the conventions in CLAUDE.md (SI units, zod at boundaries, determinism, package boundaries).
5. **Verify**: `pnpm check` must pass. If the story touches deploy, API or DB, also run `docker compose up -d --build` and check it works; then `docker compose down`. Tick the acceptance criteria in `docs/stories/$ARGUMENTS.md` only once verified.
6. **Commit** in logical steps: `$ARGUMENTS: <imperative summary>`.
7. **PR**: `git push -u origin story/$ARGUMENTS`, then `gh pr create --base main --title "$ARGUMENTS: <story title>" --body-file <file>` filled from `.github/pull_request_template.md`: `Closes #<issue>`, the acceptance-criterion → verification table, DoD checklist, notes/assumptions, follow-ups. Run `gh issue edit <issue> --add-label in-review --remove-label in-progress`.
8. Wait for CI: `gh pr checks <N> --watch`. Fix failures and push.
9. Print exactly `PR READY: #<N> <url>` and stop. The lead routes it to the reviewer.

When review feedback arrives later: address each comment (fix it or reply with a reason via `gh pr comment`), `pnpm check`, push, then print `PR UPDATED: #<N>`.

---
description: (lead only) After a story PR is merged, close out the story and clean up. Usage: /close-story <ID>
argument-hint: <story-id>
---

Story: `$ARGUMENTS`.

1. Confirm the PR is merged: `gh pr list --state merged --search "$ARGUMENTS:"`. If not merged, stop.
2. Make sure the issue is closed (the PR's `Closes #N` usually does it; otherwise `gh issue close <N> --comment "Merged in #<PR>"`). Remove `in-review`/`in-progress` labels.
3. Find the builder and its worktree workspace: `herdr agent list`, `herdr workspace list`. Ask the builder to exit (`herdr agent send-keys <builder> ctrl+c` twice, or prompt `/exit`), then `herdr worktree remove --workspace <workspace-id>` (keeps the branch).
4. `git pull` on the main checkout.
5. If the story produced follow-ups, create issues for them (ask the product owner which sprint).
6. Run `/next-story` and recommend what to dispatch next.

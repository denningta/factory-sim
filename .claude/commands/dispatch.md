---
description: (lead only) Start a builder on a story in its own herdr worktree. Usage: /dispatch <builder-name> <ID>
argument-hint: <builder-1|builder-2|builder-3> <story-id>
---

Arguments: `$ARGUMENTS` (builder name, then story ID).

1. Check `test "$HERDR_ENV" = 1` (must be inside herdr). Check the builder name isn't already live (`herdr agent list`) and the story is in the READY list (`python3 -I scripts/ready-stories.py`). Respect the max builder count in `docs/agent-team.md`.
2. Make sure any shared contract the story needs (schema, engine API) is already merged.
3. Run `scripts/team-up.sh builder <builder-name> <ID>`. It creates the worktree workspace on branch `story/<ID>`, starts Claude with the builder role and the model from the story's `builder_model`, and sends `/implement-story <ID>`.
4. `gh issue edit <issue> --add-label in-progress` and comment `Dispatched to <builder-name>`.
5. Report to the product owner in one line: who is working on what.

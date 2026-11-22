---
description: List stories ready to start (dependencies closed, not in flight, no module overlap with running builders).
argument-hint: '[sprint number]'
---

1. Run `python3 -I scripts/ready-stories.py ${ARGUMENTS:+--sprint $ARGUMENTS}` (uses live GitHub issue state).
2. Run `herdr agent list` and `git branch -r --list 'origin/story/*'` to see which builders are running and on which stories.
3. From the READY list, drop stories that touch the same module/epic as an in-flight story (e.g. two Layout-editor stories, or two stories editing `packages/sim-engine` internals).
4. Recommend the next story or stories in sprint order, noting for each: the builder model (`builder_model` from frontmatter), any shared contract (schema type, engine API) the lead must land first, and which free builder name to use. Don't dispatch; that's `/dispatch`.

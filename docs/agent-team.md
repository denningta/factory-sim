# Agent team runbook

How the Factory Flow Simulator is built by Claude Code agents in herdr. Background and reasoning: `docs/planning/agent-team-setup.md`.

## Roles

| Agent                 | Runs where                        | Role file                    | Model                        | Does                                                                               | Never                                         |
| --------------------- | --------------------------------- | ---------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------- |
| Product owner (human) | —                                 | —                            | —                            | Priorities, answers, **merges**                                                    | —                                             |
| `lead`                | main checkout, tab "control"      | `.claude/agents/lead.md`     | Opus                         | Picks and dispatches stories, owns ADRs, `packages/schema`, sim-engine API, issues | Implements feature stories, merges            |
| `builder-1..3`        | own worktree, branch `story/<ID>` | `.claude/agents/builder.md`  | Sonnet (Opus for SE-1, PR-2) | One story, tests first, opens a PR                                                 | Touches lead-owned areas, pushes main, merges |
| `reviewer`            | main checkout, tab "control"      | `.claude/agents/reviewer.md` | Opus, Edit/Write disabled    | Reviews PRs vs acceptance criteria, ADRs, DoD; runs tests                          | Edits code, merges                            |

**Max concurrent builders:** Sprint 1 = **2** (raised by the product owner on 2026-11-21 so SE-1 can run in parallel). Sprint 2 = **2**. Raise to 3 only when CI and your review time keep up (product owner decides; update this line).

## Start of day

```bash
herdr                      # attach (prefix ctrl+b; ctrl+b ? lists bindings)
cd ~/code/factory-sim && git pull
scripts/team-up.sh         # starts lead + reviewer (idempotent) and a "services" tab
```

The lead reads the docs, runs `/next-story` and **dispatches ready stories in sprint order without asking** (product owner, 2026-11-22), within the builder limit and the no-two-stories-per-module rule. It reports who is on what. It still asks before starting a new sprint, changing the builder limit, or anything outside the backlog. The lead runs `/dispatch builder-1 PL-1`, which calls `scripts/team-up.sh builder builder-1 PL-1`.

## Story pipeline

1. **Pick**: lead `/next-story` (dependencies closed, no module overlap with an in-flight story).
2. **Start**: lead `/dispatch <builder> <ID>` creates a herdr worktree workspace on `story/<ID>` and sends `/implement-story <ID>`.
3. **Build**: builder plans against the acceptance criteria, writes failing tests, implements, `pnpm check`, commits.
4. **PR**: builder opens a PR (template: criterion → verification table), waits for CI, prints `PR READY: #N`.
5. **Review**: lead prompts reviewer with `/review-pr N`. REQUEST CHANGES goes back to the same builder until APPROVE.
6. **Merge**: lead pings you with link and summary. You read the reviewer's comment, check the demo/screenshots, and merge on GitHub.
7. **Close**: lead `/close-story <ID>`: closes the issue, removes the worktree (branch kept), picks the next story.

## Answering agents

- herdr shows each agent as **working / idle / blocked / done**. _Blocked_ = waiting on a permission prompt or question.
- **Read the pane before answering. Never auto-approve.** Anything outside the story's scope (new dependency, editing schema/ADRs/CI, deleting files, network installs) → ask the lead, or decide yourself.
- To redirect a builder: tell the lead, or type in the builder's pane directly.

## Merge checklist (product owner)

- [ ] Reviewer verdict is APPROVE and CI is green
- [ ] Each acceptance criterion has a named test in the PR table
- [ ] Diff stays inside the story (no surprise edits to schema, ADRs, CI, `.claude`)
- [ ] Demo or screenshots match the wireframe (UI stories)
- [ ] Squash-merge with title `<ID>: <title>`

## Guardrails (already configured)

- **Branch protection on main**: PR + green `check` required, no force pushes, no deletions. All agents use your GitHub account, so GitHub approvals can't separate you from them. The rule that holds is that **only you click merge**; `gh pr merge` is denied for agents in `.claude/settings.json`.
- **Shared permissions** (`.claude/settings.json`): allows pnpm, git (push only `story/*`), gh issue/pr/run, docker compose, herdr agent/pane/worktree. Denies pushing main, force push, `gh pr merge`, `reset --hard`, `sudo`, reading `.env`.
- **Hook**: after every Edit/Write, prettier and the owning package's type check run; type errors are fed back to the agent.
- **Secrets**: `.env` is git-ignored and unreadable by agents; use `.env.example`.

## Useful commands

```bash
scripts/team-up.sh status                       # who is running, and their state
python3 -I scripts/ready-stories.py --sprint 1  # backlog readiness from live issues
herdr agent read builder-1 --source recent-unwrapped --lines 120
herdr agent prompt reviewer "/review-pr 12" --wait
herdr worktree remove --workspace <id>          # after merge (keeps the branch)
gh pr list ; gh issue list --label sprint:1
```

## Rollout

1. **Sprint 0** (done): repo, CLAUDE.md, `.claude/`, CI (PL-4), branch protection, issues, docs.
2. **Sprint 1**: lead + builder-1 + builder-2 (SE-1) + reviewer. Order: PL-3 (lead) → PL-1 → PL-2 → PL-5 spike → LE-1. SE-1 goes to builder-2 on Opus mid-sprint, after the lead defines the engine API.
3. **Sprint 2+**: up to 3 builders if review and CI keep up.

## Backlog maintenance

- Story specs live in `docs/stories/`. Regenerate from the sheet with `python3 -I scripts/import-backlog.py` (keeps issue numbers), then `scripts/create-issues.sh` (idempotent).
- Acceptance criteria change only with product-owner approval.

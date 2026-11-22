# Factory Flow Simulator — AI Agent Team Setup (herdr + Claude Code)

Nov 21, 2026 · @Tim Denning

## Summary

Run the build as a small, disciplined team: one **lead** Claude Code agent that plans and coordinates, up to three **builder** agents that each implement one user story in its own git worktree, and one read-only **reviewer** agent that checks every pull request against its acceptance criteria. You stay product owner and the only person who merges.

**herdr** is the control room. It doesn't replace Claude Code; it owns the terminals Claude Code runs in, keeps sessions alive across disconnects, shows which agents are working, idle or blocked, and exposes a CLI the lead agent can use to start, prompt and read the other agents. The repository itself (CLAUDE.md, ADRs, story files, GitHub Issues) is how every agent shares the same context.

Start with one lead, one builder and the reviewer in Sprint 1, then scale to three builders once CI and conventions hold.

## Team roles

Each role gets narrow ownership: builders never touch shared contracts, the reviewer never edits code, and only you merge.

| Role | Who | Owns | Never does | Suggested model |
| --- | --- | --- | --- | --- |
| Product owner | You | Priorities, acceptance, merges to main, final decisions | Writes code day to day | — |
| Lead (orchestrator) | Claude Code, herdr agent `lead` | Picks ready stories, starts and prompts builders, owns ADRs, the project schema (PL-3) and the sim-engine API, keeps issues up to date | Implements feature stories | Opus |
| Builders (2–3) | Claude Code, agents `builder-1` to `builder-3` | One story at a time in its own worktree and branch, tests first, opens a pull request | Changes ADRs, shared schema or another story's files | Sonnet (Opus for SE-1, PR-2) |
| Reviewer | Claude Code, agent `reviewer`, read-only | Reviews each pull request against acceptance criteria, ADRs and the Definition of Done; runs the tests | Edits code or merges | Opus |

Add a fourth role later if needed: a **QA agent** that runs the reference model and end-to-end browser tests (Playwright) after each merge.

## Repository setup

Agents start every session cold, so everything they need to know lives in the repo: conventions in CLAUDE.md, decisions in ADRs, work in GitHub Issues and story files.

```
factory-sim/
├─ CLAUDE.md                  # conventions every agent reads first
├─ docker-compose.yml         # app + postgres
├─ apps/
│  ├─ web/                    # three.js + UI
│  └─ api/                    # REST API, migrations
├─ packages/
│  ├─ sim-engine/             # shared discrete-event engine (lead owns the API)
│  └─ schema/                 # versioned project schema (lead owns)
├─ docs/
│  ├─ adr/                    # one markdown file per ADR
│  ├─ stories/                # one file per story: story + acceptance criteria
│  ├─ wireframes/             # exported screens from the Design mockups
│  └─ reference-model/        # 5-station, 2-product test line + expected results
└─ .claude/
   ├─ settings.json           # shared permissions and hooks
   ├─ commands/               # /implement-story, /review-pr, /next-story
   └─ agents/                 # reviewer subagent definition
```

1. **CLAUDE.md** (keep it under \~200 lines): the stack, how to run tests and the Compose stack, coding conventions, the Definition of Done, "read the ADRs in docs/adr before changing architecture," and the rule that builders stay inside their story's scope.
2. **Export the planning artifacts into docs/**: each ADR from the Whiteboard as docs/adr/NNNN-title.md, each story from the backlog Sheet as docs/stories/ID.md, and wireframe PNGs into docs/wireframes. Agents read files far more reliably than links.
3. **GitHub Issues as the live backlog**: one issue per story (title = ID + story, body = acceptance criteria, labels = epic, sprint, points). The lead uses the gh CLI to pick and update them. The Sheet stays your planning view; download it as CSV and have the lead create the issues with a short script.
4. **Slash commands** in .claude/commands: `/implement-story <ID>` (read the issue, plan, write failing tests, implement, run checks, open a PR), `/review-pr <number>` (check against acceptance criteria, ADRs and Definition of Done, then comment), `/next-story` (list ready stories whose dependencies are merged).
5. **Reviewer subagent** in .claude/agents/reviewer.md with only read, search and test-running tools.
6. **Shared permissions** in .claude/settings.json: allow pnpm, test, lint, docker compose, git and gh commands; deny pushing to main, force pushes and deleting outside the repo.
7. **Hooks**: run the formatter and type check after file edits so builders get fast feedback without being told.

## herdr setup

One herdr workspace for the main checkout (lead, reviewer, services), plus one herdr worktree workspace per builder story, so builders never share files.

**Install and connect Claude Code** (macOS or your Omarchy Linux box):

```bash
brew install herdr        # or: curl -fsSL https://herdr.dev/install.sh | sh
herdr integration install claude   # reliable working/idle/blocked state + session resume
herdr integration status
herdr                     # start the UI; prefix key is ctrl+b (ctrl+b ? lists bindings)
```

**Layout**

| herdr workspace / tab | Panes | Purpose |
| --- | --- | --- |
| factory-sim (main checkout) → tab "control" | lead, reviewer | Coordination and review; never edits story code |
| factory-sim → tab "services" | docker compose, test watcher, logs | Long-running processes that survive agent restarts |
| story/PL-1, story/SE-1, … (one worktree each) | builder-N | One builder per story branch, created per story |

**Launch script** (scripts/team-up.sh, run from a shell pane inside herdr at the repo root). herdr's creation commands return JSON; run each command once by hand to confirm the JSON field names on your installed version before relying on the script.

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO="$HOME/code/factory-sim"

# Lead and reviewer on the main checkout
lead=$(herdr pane split --current --direction right --cwd "$REPO" --no-focus | jq -r '.result.pane.pane_id')
herdr agent start lead --kind claude --pane "$lead" -- --model opus

rev=$(herdr pane split "$lead" --direction down --cwd "$REPO" --no-focus | jq -r '.result.pane.pane_id')
herdr agent start reviewer --kind claude --pane "$rev" -- --model opus --disallowedTools "Edit Write"

# One builder per story, each in its own worktree and branch
start_builder () {   # usage: start_builder builder-1 PL-1
  local name=$1 story=$2
  local pane
  pane=$(herdr worktree create --cwd "$REPO" --branch "story/$story" --label "$story" --no-focus \
          | jq -r '.result.root_pane.pane_id')
  herdr agent start "$name" --kind claude --pane "$pane" -- --model sonnet
  herdr agent prompt "$name" "/implement-story $story"
}
```

The lead can call the same commands itself (`herdr agent prompt builder-1 …`, `herdr agent read builder-1 --source recent-unwrapped --lines 120`, `herdr agent wait reviewer --until idle`), which is what makes it an orchestrator rather than another coder. Give it a `/dispatch` command that wraps start\_builder.

When a story merges: `herdr worktree remove --workspace <id>` closes the workspace and removes the checkout but keeps the branch.

**Alternative to try later:** Claude Code's experimental agent teams can open teammates as native herdr panes through the community herdr-claude-teams integration. It's less explicit than the script, so start with the script and evaluate it after Sprint 1.

## The story pipeline

&#91;embedded content: story pipeline · 7 steps, 1 decision, 2 loops\]

Every story runs the same loop. Review comments and failing CI go back to the same builder, in the same worktree, until the reviewer approves; only then do you look at it.

1. **Pick:** the lead runs `/next-story`, choosing an issue whose dependencies are merged and that doesn't touch a module another builder holds.
2. **Start:** the lead creates the worktree and branch story/ID and starts a builder with `/implement-story ID`.
3. **Build:** the builder restates the acceptance criteria as a plan, writes failing tests, implements, runs lint, type checks, tests and the Compose stack, and commits.
4. **PR:** the builder opens a pull request that links the issue and lists each acceptance criterion with how it was verified. CI runs.
5. **Review:** the lead prompts the reviewer with `/review-pr N`. Requested changes go back to the builder.
6. **Merge:** you read the reviewer's summary, check the demo or screenshots, approve and merge.
7. **Close:** the lead closes the issue, removes the worktree, updates status and picks the next story.

## Guardrails

The cheapest protection is structural: agents can propose anything, but only a green, reviewed pull request that you approve reaches main.

- **Branch protection on main**: pull requests only, CI must pass, one approval required (yours). No agent has rights to merge.
- **Permissions per role**: builders get the shared allowlist; the reviewer runs with Edit and Write disabled; nobody may push to main, force-push or run destructive commands outside the repo.
- **Narrow scope**: one story per builder, one branch per story. Changes to packages/schema, packages/sim-engine's public API or docs/adr go through the lead. Worktrees isolate files but not conflicting designs, so the lead doesn't run two stories that touch the same module at once.
- **Blocked agents**: herdr marks an agent blocked when it is waiting on a permission prompt or question. Read its pane before answering; never auto-approve.
- **Secrets**: the .env file stays out of git and out of agents' reach; use the example file for development.
- **Limit parallelism**: more agents mean more merge conflicts, CI load and review work for you. Your review time is the real bottleneck, so raise builder count only when the reviewer and CI keep up.
- **Cost**: four or five concurrent Claude Code sessions use up usage limits quickly. Plan on a Max subscription or an API budget with spend alerts, and use Sonnet for routine builder work.

## Rollout and Sprint 1 assignment

Scale in three steps, moving on only when the previous step runs cleanly for a few days.

1. **Sprint 0, one agent:** you and a single Claude Code session set up the repo, CLAUDE.md, .claude config, CI, branch protection, the GitHub Issues import and the docs/ exports. Run PL-4 (CI) here.
2. **Sprint 1, three agents:** lead + one builder + reviewer. Prove the full story pipeline end to end on small stories first.
3. **Sprint 2 onward, five agents:** lead + three builders + reviewer, if CI and your review time keep up.

**Sprint 1 plan (30 points)**

| Order | Story | Points | Agent | Why this agent |
| --- | --- | --- | --- | --- |
| 1 | PL-3 Versioned project schema | 3 | lead | Shared contract; everything else builds on it |
| 2 | PL-1 One-command Docker Compose deploy | 5 | builder-1 | Small, well-defined; good first pipeline test |
| 3 | PL-2 Data survives upgrades | 3 | builder-1 | Follows PL-1 in the same area |
| 4 | PL-5 Spike: three.js rendering approach | 3 | builder-1 | Time-boxed; output is a write-up the lead turns into an ADR |
| 5 | SE-1 Discrete-event engine core | 8 | builder-2 (Opus), from mid-sprint | Hardest story; lead defines the engine API first |
| 6 | LE-1 To-scale floor | 5 | builder-1 | Needs the PL-5 recommendation |
| — | PL-4 CI pipeline | 3 | done in Sprint 0 | Needed before any agent opens a PR |

## Sources

- [herdr docs: agents](https://herdr.dev/docs/agents/)
- [herdr docs: agent automation](https://herdr.dev/docs/agent-automation/)
- [How to manage coding agents with Herdr (Flavio Copes)](https://flaviocopes.com/herdr/)
- [awesome-herdr (community integrations, incl. herdr-claude-teams)](https://github.com/yigitkonur/awesome-herdr)

#!/usr/bin/env bash
# Start the factory-sim agent team in herdr.
#
#   scripts/team-up.sh                    # lead + reviewer on the main checkout, plus a "services" tab
#   scripts/team-up.sh builder <name> <ID>  # one builder in its own worktree on story/<ID>
#   scripts/team-up.sh status             # show live agents
#
# Run from a shell pane inside herdr (HERDR_ENV=1). JSON paths checked against herdr 0.9.5
# (protocol 22): pane split -> .result.pane.pane_id; worktree create -> .result.root_pane.pane_id,
# .result.workspace.workspace_id, .result.worktree.path.
set -euo pipefail

REPO="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"

need_herdr() {
  if [ "${HERDR_ENV:-}" != 1 ]; then
    echo "error: run this from a pane inside herdr (HERDR_ENV=1)" >&2
    exit 1
  fi
  command -v jq >/dev/null || { echo "error: jq is required" >&2; exit 1; }
}

agent_live() { herdr agent list 2>/dev/null | jq -e --arg n "$1" '.result.agents[] | select(.name == $n)' >/dev/null; }

start_core() {
  need_herdr
  local lead rev svc

  if agent_live lead; then
    echo "lead already running"
  else
    lead=$(herdr pane split --current --direction right --cwd "$REPO" --no-focus | jq -r '.result.pane.pane_id')
    herdr agent start lead --kind claude --pane "$lead" -- --agent lead --model opus --name lead
    echo "lead started in $lead"
  fi

  if agent_live reviewer; then
    echo "reviewer already running"
  else
    lead=${lead:-$(herdr agent get lead | jq -r '.result.agent.pane_id')}
    rev=$(herdr pane split "$lead" --direction down --cwd "$REPO" --no-focus | jq -r '.result.pane.pane_id')
    herdr agent start reviewer --kind claude --pane "$rev" -- \
      --agent reviewer --model opus --name reviewer --disallowedTools Edit Write NotebookEdit
    echo "reviewer started in $rev"
  fi

  if ! herdr tab list --workspace "$HERDR_WORKSPACE_ID" | jq -e '.result.tabs[] | select(.label == "services")' >/dev/null 2>&1; then
    svc=$(herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd "$REPO" --label services --no-focus \
      | jq -r '.result.root_pane.pane_id')
    echo "services tab created (pane $svc): run 'docker compose up' / 'pnpm test:watch' there"
  fi

  herdr agent prompt lead "Session start: read CLAUDE.md, docs/agent-team.md and docs/stories/README.md, then run /next-story and tell me what you recommend for this sprint. Don't dispatch anything until I confirm." >/dev/null
  echo "lead prompted. Talk to it in its pane."
}

story_model() {  # builder_model from story frontmatter, default sonnet
  local f="$REPO/docs/stories/$1.md"
  [ -f "$f" ] || { echo "error: no story file $f" >&2; exit 1; }
  sed -n 's/^builder_model: *//p' "$f" | head -1 | grep . || echo sonnet
}

start_builder() {  # usage: start_builder builder-1 PL-1
  need_herdr
  local name=$1 story=$2 model out pane ws path
  [[ "$name" =~ ^builder-[1-3]$ ]] || { echo "error: builder name must be builder-1..3" >&2; exit 1; }
  agent_live "$name" && { echo "error: $name is already running" >&2; exit 1; }
  model=$(story_model "$story")

  git -C "$REPO" fetch -q origin main
  out=$(herdr worktree create --cwd "$REPO" --branch "story/$story" --base origin/main --label "$story" --no-focus)
  pane=$(jq -r '.result.root_pane.pane_id' <<<"$out")
  ws=$(jq -r '.result.workspace.workspace_id' <<<"$out")
  path=$(jq -r '.result.worktree.path' <<<"$out")

  herdr agent start "$name" --kind claude --pane "$pane" --timeout 60000 -- \
    --agent builder --model "$model" --name "$name-$story"
  herdr agent prompt "$name" "/implement-story $story" >/dev/null
  echo "$name ($model) started on story/$story: workspace $ws, pane $pane, checkout $path"
}

case "${1:-core}" in
  core | "") start_core ;;
  builder) [ $# -eq 3 ] || { echo "usage: $0 builder <builder-N> <STORY-ID>" >&2; exit 2; }; start_builder "$2" "$3" ;;
  status) need_herdr; herdr agent list | jq -r '.result.agents[] | "\(.name // "-")\t\(.agent_status)\t\(.pane_id)\t\(.cwd)"' ;;
  *) echo "usage: $0 [core | builder <name> <ID> | status]" >&2; exit 2 ;;
esac

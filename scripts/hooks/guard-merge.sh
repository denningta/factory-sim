#!/usr/bin/env bash
# PreToolUse(Bash) guard: only the lead agent may merge PRs, and only as a squash
# without --admin (which would bypass branch protection). Product owner decision,
# 2026-11-23. Exit 2 blocks the call and shows stderr to the agent.
set -euo pipefail

cmd=$(jq -r '.tool_input.command // ""')

# Match `gh pr merge` anywhere in the command, including after && ; | or a subshell.
if ! grep -Eq '(^|[^[:alnum:]_-])gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$)' <<<"$cmd"; then
  exit 0
fi

if [ "${CLAUDE_CODE_AGENT:-}" != "lead" ]; then
  echo "Blocked: only the lead agent merges PRs (agent: ${CLAUDE_CODE_AGENT:-unknown})." >&2
  exit 2
fi
if grep -Eq -- '--admin' <<<"$cmd"; then
  echo "Blocked: --admin bypasses branch protection." >&2
  exit 2
fi
if ! grep -Eq -- '(--squash|[[:space:]]-s([[:space:]]|$))' <<<"$cmd"; then
  echo "Blocked: merge with --squash." >&2
  exit 2
fi
exit 0

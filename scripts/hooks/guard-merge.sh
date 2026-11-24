#!/usr/bin/env bash
# PreToolUse(Bash) guard: only the lead agent may merge PRs, and only as a squash without
# --admin (which would bypass branch protection). Product owner decision, 2026-11-23.
#
# Exit 2 blocks the call and shows stderr to the agent. Any failure also exits 2: Claude Code
# treats other exit codes as non-blocking, so this hook must fail closed.
#
# A regex over a shell command can't be airtight (scripts and `node -e` can still exec gh),
# so scripts/bin/gh refuses merges at the gh level too. This hook catches the direct forms
# early and with a clear message.
set -uo pipefail
trap 'echo "Blocked: merge guard failed" >&2; exit 2' ERR

raw=$(jq -er '.tool_input.command // ""')

# Normalise: join line continuations, drop quotes and backslashes, squeeze whitespace.
norm=$(printf '%s' "$raw" | sed -e ':a' -e 'N' -e '$!ba' -e 's/\\\n//g' | tr '\n\t' '  ' |
  tr -d "\"'\\\\" | tr -s ' ')

merge_re='(^|[^[:alnum:]_-])gh([[:space:]].*)?[[:space:]]pr([[:space:]].*)?[[:space:]]merge([[:space:]]|$)'
api_re='(^|[^[:alnum:]_-])gh([[:space:]].*)?[[:space:]]api([[:space:]].*)?(/merge([[:space:]/?]|$)|mergePullRequest)'
alias_re='(^|[^[:alnum:]_-])gh([[:space:]].*)?[[:space:]]alias([[:space:]]|$)'

if grep -Eq "$alias_re" <<<"$norm"; then
  echo "Blocked: gh aliases are not allowed (they can hide a merge)." >&2
  exit 2
fi
if grep -Eq "$api_re" <<<"$norm"; then
  echo "Blocked: merge through gh api is not allowed; the lead uses gh pr merge --squash." >&2
  exit 2
fi
if ! grep -Eq "$merge_re" <<<"$norm"; then
  exit 0
fi

if [ "${CLAUDE_CODE_AGENT:-}" != "lead" ]; then
  echo "Blocked: only the lead agent merges PRs (agent: ${CLAUDE_CODE_AGENT:-unknown})." >&2
  exit 2
fi
# Check flags on the merge segment only (up to the next ; & | or end).
segment=$(grep -Eo 'pr([[:space:]][^;&|]*)?[[:space:]]merge[^;&|]*' <<<"$norm" | head -1)
if grep -Eq -- '--admin' <<<"$segment"; then
  echo "Blocked: --admin bypasses branch protection." >&2
  exit 2
fi
if grep -Eq -- '--merge|--rebase|(^|[[:space:]])-(m|r)([[:space:]]|$)' <<<"$segment" ||
  ! grep -Eq -- '--squash|(^|[[:space:]])-s([[:space:]]|$)' <<<"$segment"; then
  echo "Blocked: merge with --squash." >&2
  exit 2
fi
exit 0

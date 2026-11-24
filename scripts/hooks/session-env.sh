#!/usr/bin/env bash
# SessionStart hook: put scripts/bin first on PATH for every Bash command in this session,
# so the gh wrapper (merge guard) applies to agents, scripts and child processes alike.
set -euo pipefail
[ -n "${CLAUDE_ENV_FILE:-}" ] || exit 0
echo "export PATH=\"$CLAUDE_PROJECT_DIR/scripts/bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"

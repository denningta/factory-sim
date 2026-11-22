#!/usr/bin/env bash
# PostToolUse hook: format the edited file, then type-check the package that owns it.
# Exit 2 + stderr feeds type errors back to the agent.
set -uo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] || [ ! -f "$file" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null)}"
# In a worktree the edited file may live outside CLAUDE_PROJECT_DIR; use the file's own repo root.
froot=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null || echo "$root")
cd "$froot" || exit 0
[ -d node_modules ] || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.md|*.css|*.yml|*.yaml)
    npx --no-install prettier --write --log-level warn "$file" >/dev/null 2>&1 || true ;;
esac

case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Walk up to the nearest workspace package with a tsconfig.
dir=$(dirname "$file")
while [ "$dir" != "$froot" ] && [ "$dir" != "/" ]; do
  [ -f "$dir/tsconfig.json" ] && [ -f "$dir/package.json" ] && break
  dir=$(dirname "$dir")
done
[ -f "$dir/tsconfig.json" ] || exit 0

if ! out=$(npx --no-install tsc -p "$dir/tsconfig.json" --pretty false 2>&1); then
  echo "Type check failed in ${dir#"$froot"/} after editing ${file#"$froot"/}:" >&2
  printf '%s\n' "$out" | head -40 >&2
  exit 2
fi
exit 0

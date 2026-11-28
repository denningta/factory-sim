#!/usr/bin/env bash
# Create one GitHub issue per docs/stories/<ID>.md (idempotent) and write the issue number
# back into the story frontmatter. Requires gh (authenticated) and jq.
set -euo pipefail
cd "$(dirname "$0")/.."

label() { gh label create "$1" --color "$2" --description "${3:-}" --force >/dev/null; }

echo "Creating labels…"
for e in platform layout-editor equipment-library products-routings workstation-config technicians flow-connections simulation-engine scenarios-projects analytics-kpis ui-polish shop-floor parallel-stations; do
  label "epic:$e" 1d76db
done
for s in 1 2 3 4 5 6 7 8 9 10; do label "sprint:$s" 0e8a16; done
for p in 1 2 3 4 5 8 13; do label "points:$p" c5def5; done
label priority:must b60205; label priority:should fbca04; label priority:could cccccc
label in-progress 5319e7 "A builder is working on it"
label in-review 0052cc "PR open, awaiting review/merge"
label blocked d93f0b "Waiting on a decision or dependency"
label spike f9d0c4 "Time-boxed research"

existing=$(gh issue list --state all --limit 500 --json number,title | jq -r '.[] | "\(.title | split(":")[0])\t\(.number)"')

for f in docs/stories/[A-Z][A-Z]-*.md; do
  id=$(basename "$f" .md)
  fm() { sed -n '2,/^---$/p' "$f" | grep -m1 "^$1:" | sed "s/^$1: *//"; }
  num=$(printf '%s\n' "$existing" | awk -F'\t' -v id="$id" '$1==id{print $2}')
  if [ -z "$num" ]; then
    title=$(grep -m1 '^# ' "$f" | sed 's/^# //')
    epic=$(fm epic | tr 'A-Z' 'a-z' | sed 's/ & /-/; s/ /-/g')
    labels="epic:$epic,sprint:$(fm sprint),points:$(fm points),priority:$(fm priority | tr 'A-Z' 'a-z')"
    grep -q '^# .*Spike' "$f" && labels="$labels,spike"
    deps=$(fm depends_on | tr -d '[]')
    body=$(printf '%s\n\n%s\n\n**Spec:** [`docs/stories/%s.md`](../blob/main/docs/stories/%s.md) · **Depends on:** %s · **Builder model:** %s\n' \
      "$(grep -m1 '^\*\*Story:\*\*' "$f")" \
      "$(sed -n '/^## Acceptance criteria/,/^## /p' "$f" | sed '$d')" \
      "$id" "$id" "${deps:-—}" "$(fm builder_model)")
    url=$(gh issue create --title "$title" --body "$body" --label "$labels")
    num=${url##*/}
    echo "created #$num $title"
  else
    echo "exists  #$num $id"
  fi
  sed -i "s/^issue:.*/issue: $num/" "$f"
done

#!/usr/bin/env bash
# Lead helper: run in the background (Bash run_in_background). Exits as soon as a builder
# changes state, which wakes the lead. Restart it after every wake-up.
# Exits (waking the lead) when any builder-* goes from working to a non-working state,
# or a new builder appears blocked. Prints the transition and the pane's last report line.
snap() { herdr agent list | python3 -c "import json,sys; [print(a['name'], a['agent_status']) for a in json.load(sys.stdin)['result']['agents'] if a.get('name','').startswith('builder')]" | sort; }
prev=$(snap)
while sleep 20; do
  cur=$(snap)
  while read -r name status; do
    was=$(awk -v n="$name" '$1==n{print $2}' <<<"$prev")
    if { [ "$status" = blocked ] && [ "$was" != blocked ]; } || { [ "$was" = working ] && [ "$status" != working ]; }; then
      echo "TRANSITION $name: ${was:-new} -> $status"
      herdr agent read "$name" --source recent-unwrapped --lines 40 2>/dev/null | grep -E "PR READY|PR UPDATED|\?$|blocked|lead" | tail -3
      exit 0
    fi
  done <<<"$cur"
  prev=$cur
done

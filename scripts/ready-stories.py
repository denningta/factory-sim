#!/usr/bin/env python3
"""List stories that are ready to start.

Ready = issue open, not labelled in-progress/in-review/blocked, and every depends_on story's
issue is closed. Sorted by sprint, then backlog order. Uses `gh issue list` for live state.

Usage: python3 -I scripts/ready-stories.py [--sprint N] [--json]
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUSY = {"in-progress", "in-review", "blocked"}


def stories():
    out = []
    for f in sorted((ROOT / "docs/stories").glob("*-*.md")):
        fm = f.read_text().split("---")[1]
        d = dict(re.findall(r"^(\w+): *(.*)$", fm, re.M))
        d["depends_on"] = [x.strip() for x in d.get("depends_on", "").strip("[]").split(",") if x.strip()]
        d["title"] = re.search(r"^# (.+)$", f.read_text(), re.M).group(1)
        out.append(d)
    return out


def issues():
    res = subprocess.run(
        ["gh", "issue", "list", "--state", "all", "--limit", "500", "--json", "number,title,state,labels"],
        cwd=ROOT, capture_output=True, text=True, check=True)
    by_id = {}
    for i in json.loads(res.stdout):
        m = re.match(r"([A-Z]{2}-\d+):", i["title"])
        if m:
            by_id[m.group(1)] = {"number": i["number"], "state": i["state"],
                                 "labels": {l["name"] for l in i["labels"]}}
    return by_id


def main():
    sprint = None
    if "--sprint" in sys.argv:
        sprint = sys.argv[sys.argv.index("--sprint") + 1]
    st, iss = stories(), issues()
    closed = {k for k, v in iss.items() if v["state"] == "CLOSED"}
    ready, busy, waiting = [], [], []
    for s in st:
        i = iss.get(s["id"])
        if not i or i["state"] == "CLOSED" or (sprint and s["sprint"] != sprint):
            continue
        row = {"id": s["id"], "issue": i["number"], "sprint": int(s["sprint"]), "points": s["points"],
               "title": s["title"], "builder_model": "lead" if s.get("owner") == "lead" else s.get("builder_model", "sonnet")}
        if i["labels"] & BUSY:
            busy.append({**row, "status": sorted(i["labels"] & BUSY)})
        elif all(d in closed for d in s["depends_on"]):
            ready.append(row)
        else:
            waiting.append({**row, "waiting_on": [d for d in s["depends_on"] if d not in closed]})
    for lst in (ready, busy, waiting):
        lst.sort(key=lambda r: r["sprint"])
    if "--json" in sys.argv:
        print(json.dumps({"ready": ready, "in_flight": busy, "waiting": waiting}, indent=2))
        return
    print("READY:")
    for r in ready:
        print(f"  {r['id']:6} #{r['issue']:<4} s{r['sprint']} {r['points']}pt [{r['builder_model']}] {r['title']}")
    print("IN FLIGHT:")
    for r in busy:
        print(f"  {r['id']:6} #{r['issue']:<4} {','.join(r['status'])}")
    print("WAITING:")
    for r in waiting[:15]:
        print(f"  {r['id']:6} s{r['sprint']} waiting on {', '.join(r['waiting_on'])}")


if __name__ == "__main__":
    main()

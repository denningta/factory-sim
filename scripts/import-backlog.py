#!/usr/bin/env python3
"""Generate docs/stories/*.md from docs/planning/mvp-backlog.xlsx (stdlib only).

Usage: python3 -I scripts/import-backlog.py [xlsx] [outdir]
Existing `issue:` numbers in story frontmatter are preserved.
"""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
# Extra dependencies from docs/planning/agent-team-setup.md not captured in the sheet.
EXTRA_DEPS = {"LE-1": ["PL-5"]}
# Stories whose builder should run on Opus (agent-team-setup.md).
OPUS = {"SE-1", "PR-2"}
# Stories the lead implements itself (shared contracts).
LEAD_OWNED = {"PL-3"}


def title(story):
    """'As a X, I want to do Y so that Z' -> 'Do Y' (prefixed 'Spike: ' for spikes)."""
    m = re.search(r"I want (?:to )?(.+?) so that", story)
    t = m.group(1) if m else story
    t = t[0].upper() + t[1:]
    return f"Spike: {t}" if story.lower().startswith("spike") else t


def read_sheets(path):
    z = zipfile.ZipFile(path)
    ss = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        ss = ["".join(t.text or "" for t in si.iter(M + "t")) for si in root.findall(M + "si")]
    sheets = []
    for name in sorted(n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml", n)):
        rows = []
        for row in ET.fromstring(z.read(name)).iter(M + "row"):
            vals = {}
            for c in row.findall(M + "c"):
                col = re.match(r"[A-Z]+", c.get("r")).group()
                v, t = c.find(M + "v"), c.get("t")
                if t == "s" and v is not None:
                    vals[col] = ss[int(v.text)]
                elif t == "inlineStr":
                    vals[col] = "".join(x.text or "" for x in c.iter(M + "t"))
                else:
                    vals[col] = v.text if v is not None else ""
            if any(vals.values()):
                width = max(ord(k[-1]) - 64 for k in vals)
                rows.append([vals.get(chr(65 + i), "") for i in range(width)])
        sheets.append(rows)
    return sheets


def main():
    xlsx = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/planning/mvp-backlog.xlsx")
    out = Path(sys.argv[2] if len(sys.argv) > 2 else "docs/stories")
    out.mkdir(parents=True, exist_ok=True)
    backlog, sprints, guide = read_sheets(xlsx)[:3]
    header = backlog[0]
    stories = []
    for r in backlog[1:]:
        r = r + [""] * (len(header) - len(r))
        d = dict(zip(header, r))
        sid = d["ID"].strip()
        deps = [x.strip() for x in d.get("Depends on", "").split(",") if x.strip()]
        deps += [x for x in EXTRA_DEPS.get(sid, []) if x not in deps]
        ac = [re.sub(r"^[•\-\s]+", "", line).strip() for line in d["Acceptance criteria"].splitlines()]
        stories.append(dict(id=sid, epic=d["Epic"], story=d["User story"].strip(), ac=[a for a in ac if a],
                            points=d["Points"], priority=d["Priority"], sprint=d["Sprint"], deps=deps))

    for s in stories:
        f = out / f"{s['id']}.md"
        issue = ""
        if f.exists():
            m = re.search(r"^issue: *(\d+)", f.read_text(), re.M)
            issue = m.group(1) if m else ""
        model = "opus" if s["id"] in OPUS else "sonnet"
        spike = s["story"].lower().startswith("spike")
        lines = [
            "---",
            f"id: {s['id']}",
            f"epic: {s['epic']}",
            f"points: {s['points']}",
            f"priority: {s['priority']}",
            f"sprint: {s['sprint']}",
            f"depends_on: [{', '.join(s['deps'])}]",
            f"builder_model: {model}",
            f"owner: {'lead' if s['id'] in LEAD_OWNED else 'builder'}",
            f"issue: {issue}",
            "---",
            "",
            f"# {s['id']}: {title(s['story'])}",
            "",
            f"**Story:** {s['story']}",
            "",
            "## Acceptance criteria",
            "",
            *[f"- [ ] {a}" for a in s["ac"]],
            "",
        ]
        if spike:
            lines += ["## Spike output", "",
                      "A write-up in `docs/spikes/` that the lead turns into an ADR update. Prototype code stays out of production packages.", ""]
        lines += ["## Notes", "", "_Added by the lead or builder during the story: design decisions, open questions, links._", ""]
        f.write_text("\n".join(lines))

    # README with sprint plan
    by_sprint = {}
    for s in stories:
        by_sprint.setdefault(s["sprint"], []).append(s)
    goals = {r[0]: r[1] for r in sprints[1:] if r and r[0].isdigit()}
    md = ["# Stories", "",
          "One file per story, generated from `docs/planning/mvp-backlog.xlsx` by `scripts/import-backlog.py`.",
          "GitHub Issues are the live status; these files are the spec. Acceptance criteria change only with product-owner approval.", ""]
    for sp in sorted(by_sprint, key=int):
        pts = sum(int(s["points"]) for s in by_sprint[sp])
        md += [f"## Sprint {sp}: {goals.get(sp, '')} ({pts} pts)", "", "| ID | Epic | Pts | Priority | Depends on |", "|---|---|---|---|---|"]
        md += [f"| [{s['id']}]({s['id']}.md) | {s['epic']} | {s['points']} | {s['priority']} | {', '.join(s['deps']) or '—'} |" for s in by_sprint[sp]]
        md.append("")
    (out / "README.md").write_text("\n".join(md))

    # Definition of Done + glossary
    gl = {r[0]: r[1] for r in guide[1:] if len(r) > 1}
    dod = gl.get("Definition of Done", "")
    items = [x.strip() for x in dod.split(":", 1)[-1].split(";")]
    (out.parent / "definition-of-done.md").write_text(
        "# Definition of Done\n\nApplies to every story. A PR is not ready for the product owner until all are true:\n\n"
        + "\n".join(f"- [ ] {i.rstrip('.')}" for i in items if i)
        + "\n- [ ] Lint, type check and unit tests pass locally and in CI\n- [ ] PR body maps each acceptance criterion to the test or check that verifies it\n\n"
        + f"## Definition of Ready\n\n{gl.get('Definition of Ready', '')}\n")
    print(f"wrote {len(stories)} stories to {out}")


if __name__ == "__main__":
    main()

# Reference model (regression test)

ADR-0012: a small model with known results runs in CI so that engine changes that shift results are caught. SE-6 AC1 runs it through `compileLine` / `createRun` and checks `expected.json`. Owner: lead; change the model or its expected results only in a lead PR.

- `model.json`: the project document (schema v4).
- `expected.json`: run settings, expected results and tolerances. `value` + `relTol`/`absTol`, or `min`/`max` bounds. Check the fixed seed `run.seed` and every seed in `seeds`.

## Line

```
Source → S1 Saw → B1 ─→ S2 CNC ─→ B2 → S3 Weld → B3 ─→ S4 Assemble ─→ B4 → S5 Inspect → Sink
                   └──── bypass ───┘               └────── bypass ──────┘
```

| Station     | A (Bracket, 60 %)     | B (Frame, 40 %)    | Labor                           | Tech   |
| ----------- | --------------------- | ------------------ | ------------------------------- | ------ |
| S1 Saw      | 40 s                  | 35 s               | manual                          | Tech 1 |
| S2 CNC      | 45 s                  | (bypasses)         | automatic, load 5 s, unload 5 s | Tech 1 |
| S3 Weld     | 90 s                  | 80 s               | manual                          | Tech 2 |
| S4 Assemble | (bypasses)            | 60 s               | manual                          | Tech 3 |
| S5 Inspect  | triangular 24/30/36 s | normal 25 s, σ 3 s | manual                          | Tech 3 |

- Release: one part every 30 s, heijunka sequence `A A B A B`.
- Buffers: B1 3, B2 4, B3 4, B4 3. Connections hand off directly (capacity 0, instant), except S5 → Sink: unlimited, 20 s transfer (parts in transit count as WIP).
- Techs walk at 1.2 m/s. S2 and S4 sit 4 m off the main line, so Tech 1 and Tech 3 walk about 7.2 m (6 s) each way.
- Run: 1 h warm-up, 24 h measured. The long window keeps the Little's-law boundary error (lead time ÷ window, about 1–2 %) well inside 5 %.

## Why these results (derivation of `expected.json`)

Work per part, averaged over the 5-part pattern (3 A + 2 B):

| Resource | Seconds per part                                            | Load       |
| -------- | ----------------------------------------------------------- | ---------- |
| S3 Weld  | (3·90 + 2·80) / 5 = **86**                                  | bottleneck |
| Tech 1   | S1 38 + S2 load/unload 3·10/5 = 44, plus up to 7.2 walking  | ≈ 51       |
| Tech 3   | S4 2·60/5 + S5 (3·30 + 2·25)/5 = 52, plus up to 4.8 walking | ≈ 57       |
| S1 Saw   | (3·40 + 2·35) / 5 = 38                                      |            |
| Source   | 30                                                          |            |

1. Everything upstream of Weld is faster than 86 s per part, so B2 fills during the warm-up and Weld never starves. Everything downstream is faster too, and the sink accepts all, so Weld never blocks. Weld (and Tech 2) work about 100 % of the window.
2. Throughput = 3600 / 86 = **41.86 parts/h**: A 60 % = 25.12, B 40 % = 16.74.
3. Each resource's working fraction = throughput × its work per part ÷ 3600. This holds whatever the tie-breaking rules, as long as the line is in steady state: S1 38/86, S2 (load + cycle + unload) 3·55/5/86 = 33/86, S4 24/86, S5 28/86, Tech 1 44/86, Tech 3 52/86.
4. The release interval (30 s) is shorter than S1's cycle, so S1 always has a part waiting: it is working, blocked or waiting for Tech 1, almost never starved. S4 and S5 have slack and an unlimited exit, so they almost never block.

Tolerances cover window-edge effects (one cycle out of 86 400 s) and the S5 sampling noise; they don't depend on the seed.

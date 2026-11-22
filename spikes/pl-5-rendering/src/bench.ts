export type Mode = 'naive' | 'instanced';
export interface Config {
  mode: Mode;
  lod: boolean;
}
export interface Sample {
  label: string;
  fps: number;
  medianFps: number;
  p95ms: number;
  drawCalls: number;
  triangles: number;
  maxMs: number;
  updateMs: number;
  warmupMs?: number;
}

/** Mutable bench state shared with the render loop (kept out of React state: CLAUDE.md). */
export const bench = {
  config: { mode: 'instanced', lod: true } as Config,
  frameTimes: [] as number[],
  info: { calls: 0, triangles: 0 },
  updateMs: [] as number[],
  updateStart: 0,
  results: [] as Sample[],
};

export function summarize(label: string): Sample {
  const t = bench.frameTimes.slice().sort((a, b) => a - b);
  const mean = t.reduce((a, b) => a + b, 0) / Math.max(1, t.length);
  const p95 = t[Math.floor(t.length * 0.95)] ?? 0;
  return {
    label,
    fps: 1000 / mean,
    medianFps: 1000 / (t[Math.floor(t.length / 2)] || Infinity),
    p95ms: p95,
    drawCalls: bench.info.calls,
    triangles: bench.info.triangles,
    maxMs: t[t.length - 1] ?? 0,
    updateMs: bench.updateMs.reduce((a, b) => a + b, 0) / Math.max(1, bench.updateMs.length),
  };
}

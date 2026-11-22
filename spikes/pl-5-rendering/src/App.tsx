import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { bench, summarize, type Config } from './bench';
import { Scene } from './Scene';

const CONFIGS: { label: string; config: Config }[] = [
  { label: 'naive', config: { mode: 'naive', lod: false } },
  { label: 'naive+LOD', config: { mode: 'naive', lod: true } },
  { label: 'instanced', config: { mode: 'instanced', lod: false } },
  { label: 'instanced+LOD', config: { mode: 'instanced', lod: true } },
];
// ?order=reverse runs the configs last-to-first, to expose thermal drift between runs.
const ORDER =
  new URLSearchParams(location.search).get('order') === 'reverse'
    ? [...CONFIGS].reverse()
    : CONFIGS;
const SETTLE_MS = 2000;
const MEASURE_MS = 5000;

declare global {
  interface Window {
    __bench?: { done: boolean; results: typeof bench.results; gpu: string };
  }
}

export function App() {
  const [config, setConfig] = useState<Config>(bench.config);
  const [auto, setAuto] = useState(() => new URLSearchParams(location.search).has('auto'));
  const readout = useRef<HTMLPreElement>(null);

  useEffect(() => {
    bench.config = config;
  }, [config]);

  // fps readout updates the DOM directly, not React state.
  useEffect(() => {
    const id = setInterval(() => {
      const s = summarize('live');
      if (readout.current)
        readout.current.textContent = `${s.fps.toFixed(1)} fps  p95 ${s.p95ms.toFixed(1)} ms\ncalls ${s.drawCalls}  tris ${s.triangles}`;
    }, 500);
    return () => clearInterval(id);
  }, []);

  // ?auto: cycle through every configuration and publish results on window.__bench.
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const gpu = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    })();
    window.__bench = { done: false, results: [], gpu };
    bench.results = [];
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    void (async () => {
      for (const c of ORDER) {
        if (cancelled) return;
        setConfig(c.config);
        // Wait for frames to stabilise: first use of a new program can stall for seconds
        // (shader compile); that hitch is reported, not folded into steady-state fps.
        const t0 = performance.now();
        await wait(SETTLE_MS);
        while (
          !cancelled &&
          performance.now() - t0 < 30000 &&
          !(bench.frameTimes.length >= 20 && bench.frameTimes.slice(-20).every((x) => x < 200))
        )
          await wait(250);
        const warmup = performance.now() - t0 - SETTLE_MS;
        bench.frameTimes.length = 0;
        bench.updateMs.length = 0;
        await wait(MEASURE_MS);
        bench.results.push({ ...summarize(c.label), warmupMs: Math.max(0, warmup) });
        window.__bench = { done: false, results: [...bench.results], gpu };
      }
      window.__bench = { done: true, results: [...bench.results], gpu };
      setAuto(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [auto]);

  return (
    <>
      <Canvas camera={{ position: [0, 55, 75], fov: 50, far: 500 }}>
        <Scene config={config} />
        <OrbitControls />
      </Canvas>
      <div
        style={{
          position: 'fixed',
          top: 8,
          left: 8,
          color: '#e8e8e8',
          font: '13px monospace',
          background: '#000a',
          padding: 8,
        }}
      >
        <pre ref={readout} style={{ margin: 0 }} />
        {CONFIGS.map((c) => (
          <label key={c.label} style={{ display: 'block' }}>
            <input
              type="radio"
              checked={config.mode === c.config.mode && config.lod === c.config.lod}
              onChange={() => setConfig(c.config)}
            />{' '}
            {c.label}
          </label>
        ))}
        <button onClick={() => setAuto(true)} disabled={auto}>
          {auto ? 'benchmarking…' : 'run benchmark'}
        </button>
      </div>
    </>
  );
}

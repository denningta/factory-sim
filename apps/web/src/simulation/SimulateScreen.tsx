import { useEffect, useMemo, useReducer, useState } from 'react';
import { createProject, type Project } from '@factory-sim/schema';
import type { ModelIssue } from '@factory-sim/sim-engine';
import { FloorScene } from '../layout/FloorScene';
import { useEditorStore } from '../layout/editorStore';
import { PartLayer } from './PartLayer';
import { TechLayer } from './TechLayer';
import { createRunSession, type RunSessionResult } from './runSession';

const SPEEDS = [1, 10, 100, 1000];
/** SE-4 adds run length and seed settings; until then a run is one 8 h shift. */
const SHIFT_SECONDS = 8 * 3600;

function currentProject(): Project {
  const s = useEditorStore.getState();
  return {
    ...createProject(),
    floor: s.floor,
    equipment: s.equipment,
    connections: s.connections,
    products: s.products,
    cycleTimes: s.cycleTimes,
    technicians: s.technicians,
    demand: s.demand,
    release: s.release,
  };
}

const clock = (t: number) => {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = Math.floor(t % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

/** Wireframe 3 (simulation run), SE-3 part: the 3D line with parts moving through it. */
export function SimulateScreen() {
  const result = useMemo<RunSessionResult>(
    () => createRunSession(currentProject(), { seed: 1, warmUp: 0, runLength: SHIFT_SECONDS }),
    [],
  );
  if (!result.ok) return <Issues issues={result.issues} />;
  return <Running session={result.session} />;
}

function Running({ session }: { session: Extract<RunSessionResult, { ok: true }>['session'] }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [now, setNow] = useState(0);
  useEffect(() => session.subscribe(rerender), [session]);
  // The clock readout is text, not per-frame React state: poll it a few times a second.
  useEffect(() => {
    const id = setInterval(() => setNow(session.now), 200);
    return () => clearInterval(id);
  }, [session]);
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', height: '100%' }}>
      <div
        role="toolbar"
        aria-label="Playback"
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          padding: 8,
          font: '14px sans-serif',
        }}
      >
        <button onClick={() => (session.playing ? session.pause() : session.play())}>
          {session.playing ? 'Pause' : 'Play'}
        </button>
        <button onClick={() => session.step()} disabled={session.done}>
          Step
        </button>
        <button onClick={() => session.runToEnd()} disabled={session.done}>
          Run to end
        </button>
        <button
          onClick={() => {
            session.reset();
            setNow(0);
          }}
        >
          Reset
        </button>
        <label>
          Speed{' '}
          <select value={session.speed} onChange={(e) => session.setSpeed(Number(e.target.value))}>
            {SPEEDS.map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={session.animate}
            onChange={(e) => session.setAnimate(e.target.checked)}
          />{' '}
          Animate
        </label>
        <span role="timer" aria-label="Simulation clock">
          {clock(now)}
          {session.done ? ' (finished)' : ''}
        </span>
      </div>
      <FloorScene interactive={false}>
        <PartLayer session={session} />
        <TechLayer session={session} />
      </FloorScene>
    </div>
  );
}

function Issues({ issues }: { issues: ModelIssue[] }) {
  return (
    <div role="alert" style={{ padding: 16, font: '14px sans-serif' }}>
      <p>The line can't run yet:</p>
      <ul>
        {issues.map((i, k) => (
          <li key={k}>{i.message}</li>
        ))}
      </ul>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { createProject, type Project } from '@factory-sim/schema';
import { compileLine, createRun, type ModelIssue } from '@factory-sim/sim-engine';
import { FloorScene } from '../layout/FloorScene';
import { useEditorStore } from '../layout/editorStore';
import { PartLayer, type PlaybackControl } from './PartLayer';
import { createPlayback } from './playback';
import { buildLineGeometry } from './partTracks';

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

function build() {
  const compiled = compileLine(currentProject());
  if (!compiled.ok) return { issues: compiled.issues };
  const s = useEditorStore.getState();
  const run = createRun(compiled.model, { seed: 1, warmUp: 0, runLength: SHIFT_SECONDS });
  const playback = createPlayback(
    run,
    buildLineGeometry(s.equipment, s.connections),
    new Map(s.products.map((p) => [p.id, p.color])),
  );
  return { playback };
}

const clock = (t: number) => {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = Math.floor(t % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

/** Wireframe 3 (simulation run), SE-3 part: the 3D line with parts moving through it. */
export function SimulateScreen() {
  const [version, setVersion] = useState(0);
  const built = useMemo(() => build(), [version]);
  const control = useRef<PlaybackControl | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [animate, setAnimate] = useState(true);
  const [now, setNow] = useState(0);

  if (built.playback) {
    control.current ??= { playback: built.playback, playing: false };
    control.current.playback = built.playback;
  }
  useEffect(() => {
    if (control.current) control.current.playing = playing;
  }, [playing]);
  useEffect(() => {
    if (built.playback) {
      built.playback.speed = speed;
      built.playback.animate = animate;
    }
  }, [built, speed, animate]);
  // The clock readout is text, not per-frame React state: poll it a few times a second.
  useEffect(() => {
    const id = setInterval(() => {
      const pb = control.current?.playback;
      if (!pb) return;
      setNow(pb.run.now);
      if (pb.run.done) setPlaying(false);
    }, 200);
    return () => clearInterval(id);
  }, []);

  if (!built.playback) return <Issues issues={built.issues ?? []} />;
  const playback = built.playback;
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
        <button onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
        <button
          onClick={() => {
            setPlaying(false);
            setNow(0);
            setVersion((v) => v + 1);
          }}
        >
          Reset
        </button>
        <label>
          Speed{' '}
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />{' '}
          Animate
        </label>
        <span role="timer" aria-label="Simulation clock">
          {clock(now)}
          {playback.run.done ? ' (finished)' : ''}
        </span>
      </div>
      <FloorScene interactive={false}>
        <PartLayer control={control as { current: PlaybackControl }} />
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

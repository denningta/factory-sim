import { useEffect, useMemo, useReducer, useState } from 'react';
import type { Equipment, Product } from '@factory-sim/schema';
import type { ModelIssue } from '@factory-sim/sim-engine';
import { FloorScene } from '../layout/FloorScene';
import { useEditorStore } from '../layout/editorStore';
import { currentProject } from './currentProject';
import { KpiPanel } from './KpiPanel';
import { issueTarget } from './issueTarget';
import { PartLayer } from './PartLayer';
import { Legend } from './Legend';
import { RunConnections } from './RunConnections';
import { StationLayer } from './StationLayer';
import { BottleneckTile } from './BottleneckTile';
import { RunSettingsPanel } from './RunSettingsPanel';
import { TechLayer } from './TechLayer';
import type { RunSessionResult } from './runSession';
import { useSessionStore } from './sessionStore';
import { fromProjectRun, toProjectRun, toRunOptions, type RunSettings } from './runSettings';

// Same range as the session's clamp (runSession MIN_SPEED/MAX_SPEED).
const MIN_SPEED = 1;
const MAX_SPEED = 1000;

const clock = (t: number) => {
  const total = Math.floor(t);
  const day = Math.floor(total / 86400) + 1;
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Day ${day}, ${pad(h)}:${pad(m)}:${pad(total % 60)}`;
};

/** Wireframe 3 (simulation run): the 3D line with parts moving through it, and run settings. */
export function SimulateScreen({
  onNavigate,
  playRequest,
  onPlayRequestHandled,
}: {
  /** Switches the editor screen when a clicked issue points at an object on another one. */
  onNavigate?: (screen: 'layout' | 'products') => void;
  /** Set by the top bar's Run simulation: start playback, then call `onPlayRequestHandled`. */
  playRequest?: boolean;
  onPlayRequestHandled?: () => void;
}) {
  const run = useEditorStore((s) => s.run);
  const shiftLength = useEditorStore((s) => s.shiftLength);
  const products = useEditorStore((s) => s.products);
  const equipment = useEditorStore((s) => s.equipment);
  // The engine reports utilization for workstations only.
  const stations = useMemo(
    () => equipment.filter((e) => e.behavior === 'workstation'),
    [equipment],
  );
  // The run lives in the session store so it outlives this tab; a changed model starts a new one.
  const current = useSessionStore((s) => s.current);
  useEffect(() => useSessionStore.getState().ensureFreshRun(), []);
  const result: RunSessionResult | undefined = current?.result;
  // A run that can't start never consumes the request; clear it so playback doesn't start unasked later.
  const failed = result !== undefined && !result.ok;
  useEffect(() => {
    if (failed && playRequest) onPlayRequestHandled?.();
  }, [failed, playRequest, onPlayRequestHandled]);
  if (!current || !result) return null;
  const apply = (next: RunSettings, shiftLength: number) => {
    useEditorStore.getState().applyRun(toProjectRun(next), shiftLength);
    const { options, seed } = toRunOptions(next, shiftLength);
    useSessionStore.getState().startRunWith(options, seed);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', height: '100%' }}>
      {result.ok ? (
        <Running
          session={result.session}
          stations={stations}
          products={products}
          playRequest={playRequest}
          onPlayRequestHandled={onPlayRequestHandled}
        />
      ) : (
        <Issues issues={result.issues} onNavigate={onNavigate} />
      )}
      <div style={{ overflowY: 'auto' }}>
        {result.ok && (
          <>
            <KpiPanel session={result.session} products={products} shiftLength={shiftLength} />
            <BottleneckTile session={result.session} stations={stations} />
          </>
        )}
        <RunSettingsPanel
          // Remounts on undo or load so the fields follow the saved values.
          key={JSON.stringify([run, shiftLength])}
          initial={fromProjectRun(run)}
          shiftLength={shiftLength}
          seedUsed={current.settings.seed}
          onApply={apply}
        />
      </div>
    </div>
  );
}

function Running({
  session,
  stations,
  products,
  playRequest,
  onPlayRequestHandled,
}: {
  session: Extract<RunSessionResult, { ok: true }>['session'];
  stations: readonly Equipment[];
  products: readonly Product[];
  playRequest?: boolean;
  onPlayRequestHandled?: () => void;
}) {
  const equipment = useEditorStore((s) => s.equipment);
  const connections = useEditorStore((s) => s.connections);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!playRequest) return;
    session.play();
    onPlayRequestHandled?.();
  }, [playRequest, session, onPlayRequestHandled]);
  useEffect(() => session.subscribe(rerender), [session]);
  // The clock readout is text, not per-frame React state: poll it a few times a second.
  useEffect(() => {
    setNow(session.now); // a new session starts at 0; don't show the old run's time
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
        <button onClick={() => session.play()} disabled={session.playing}>
          Play
        </button>
        <button onClick={() => session.pause()} disabled={!session.playing}>
          Pause
        </button>
        <button onClick={() => session.step()} disabled={session.done}>
          Step
        </button>
        <button
          onClick={() => {
            useSessionStore.getState().resetRun();
            setNow(0);
          }}
        >
          Reset
        </button>
        <button onClick={() => session.runToEnd()} disabled={session.done}>
          Run to end
        </button>
        <label>
          Speed{' '}
          <input
            type="range"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={1}
            value={session.speed}
            onChange={(e) => session.setSpeed(Number(e.target.value))}
          />{' '}
          <output>{session.speed}×</output>
        </label>
        <label>
          <input
            type="checkbox"
            checked={session.animate}
            onChange={(e) => session.setAnimate(e.target.checked)}
          />{' '}
          Animate
        </label>
        <span>
          Sim clock ·{' '}
          <span role="timer" aria-label="Simulation clock">
            {clock(now)}
            {session.done ? ' (finished)' : ''}
          </span>
        </span>
      </div>
      <div style={{ position: 'relative', minHeight: 0 }}>
        <FloorScene interactive={false}>
          <RunConnections session={session} equipment={equipment} connections={connections} />
          <StationLayer session={session} stations={stations} />
          <PartLayer session={session} />
          <TechLayer session={session} />
        </FloorScene>
        <Legend products={products} />
      </div>
    </div>
  );
}

function Issues({
  issues,
  onNavigate,
}: {
  issues: ModelIssue[];
  onNavigate?: (screen: 'layout' | 'products') => void;
}) {
  const select = (issue: ModelIssue) => {
    const target = issueTarget(currentProject(), issue);
    if (!target) return;
    if (target.screen === 'layout')
      useEditorStore.getState().selectEquipment(target.equipmentId, false);
    else useEditorStore.getState().selectProduct(target.productId);
    onNavigate?.(target.screen);
  };
  return (
    <div role="alert" style={{ padding: 16, font: '14px sans-serif' }}>
      <p>The line can't run yet:</p>
      <ul>
        {issues.map((i, k) => (
          <li key={k}>
            {i.objectId ? (
              <button
                onClick={() => select(i)}
                // Not `all: unset`: that would also remove the browser's focus outline.
                style={{
                  background: 'none',
                  border: 0,
                  padding: 0,
                  font: 'inherit',
                  color: 'inherit',
                  textAlign: 'left',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {i.message}
              </button>
            ) : (
              i.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

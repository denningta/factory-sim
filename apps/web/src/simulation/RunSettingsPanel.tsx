import { useEffect, useState } from 'react';
import { validateRunSettings, type RunSettings } from './runSettings';

interface Props {
  initial: RunSettings;
  /** Shift length in seconds, as stored in the project. */
  shiftLength: number;
  /** The seed the current run uses (a random draw shows up here). */
  seedUsed: number;
  onApply: (settings: RunSettings, shiftLength: number) => void;
}

const box = { display: 'grid', gap: 2, font: '12px sans-serif' } as const;

/** Wireframe 3 "Run settings" (SE-4). Edits apply together and start a fresh run. */
export function RunSettingsPanel({ initial, shiftLength, seedUsed, onApply }: Props) {
  const [warmUp, setWarmUp] = useState(String(initial.warmUpHours));
  const [length, setLength] = useState(String(initial.runLength));
  const [unit, setUnit] = useState(initial.runUnit);
  const [seedMode, setSeedMode] = useState(initial.seedMode);
  const [seed, setSeed] = useState(String(initial.seed));
  const [shiftHours, setShiftHours] = useState(String(shiftLength / 3600));
  // Follows edits made elsewhere (undo, load) without discarding other drafts.
  useEffect(() => setShiftHours(String(shiftLength / 3600)), [shiftLength]);
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const settings: RunSettings = {
      warmUpHours: Number(warmUp),
      runLength: Number(length),
      runUnit: unit,
      seedMode,
      seed: Number(seed),
    };
    const shift = Number(shiftHours) * 3600;
    const problem =
      validateRunSettings(settings, shift) ??
      (Number.isFinite(shift) && shift > 0 ? null : 'Shift length must be more than 0');
    setError(problem);
    if (!problem) onApply(settings, shift);
  };

  return (
    <section
      aria-label="Run settings"
      style={{ display: 'grid', gap: 8, padding: 12, alignContent: 'start' }}
    >
      <h2 style={{ font: '600 12px sans-serif', margin: 0 }}>RUN SETTINGS</h2>
      <label style={box}>
        Shift length (hr)
        <input
          type="number"
          min="0"
          step="any"
          value={shiftHours}
          onChange={(e) => setShiftHours(e.target.value)}
        />
      </label>
      <label style={box}>
        Warm-up (hr)
        <input
          type="number"
          min="0"
          step="any"
          value={warmUp}
          onChange={(e) => setWarmUp(e.target.value)}
        />
      </label>
      <label style={box}>
        Run length
        <input
          type="number"
          min="0"
          step="any"
          value={length}
          onChange={(e) => setLength(e.target.value)}
        />
      </label>
      <label style={box}>
        Run length unit
        <select value={unit} onChange={(e) => setUnit(e.target.value as RunSettings['runUnit'])}>
          <option value="shifts">shifts</option>
          <option value="hours">hours</option>
        </select>
      </label>
      <label style={box}>
        Seed mode
        <select
          value={seedMode}
          onChange={(e) => setSeedMode(e.target.value as RunSettings['seedMode'])}
        >
          <option value="fixed">Fixed</option>
          <option value="random">Random each run</option>
        </select>
      </label>
      <label style={box}>
        Seed
        <input type="number" step="1" value={seed} onChange={(e) => setSeed(e.target.value)} />
      </label>
      <button onClick={apply}>Apply</button>
      {error && <p style={{ margin: 0, color: '#b91c1c', font: '12px sans-serif' }}>{error}</p>}
      <p role="status" aria-label="Seed used" style={{ margin: 0, font: '12px sans-serif' }}>
        Seed used: {seedUsed}
      </p>
    </section>
  );
}

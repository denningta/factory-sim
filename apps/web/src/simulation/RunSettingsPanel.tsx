import { useEffect, useState } from 'react';
import { Button } from '../ui';
import styles from './RunSettingsPanel.module.css';
import { validateRunSettings, type RunSettings } from './runSettings';

interface Props {
  initial: RunSettings;
  /** Shift length in seconds, as stored in the project. */
  shiftLength: number;
  onApply: (settings: RunSettings, shiftLength: number) => void;
}

/** Wireframe 3 "Run settings" (SE-4). Edits apply together and start a fresh run. */
export function RunSettingsPanel({ initial, shiftLength, onApply }: Props) {
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
    <section aria-label="Run settings" className={styles.panel}>
      <label className={styles.field}>
        Shift length (hr)
        <input
          type="number"
          min="0"
          step="any"
          value={shiftHours}
          onChange={(e) => setShiftHours(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Warm-up (hr)
        <input
          type="number"
          min="0"
          step="any"
          value={warmUp}
          onChange={(e) => setWarmUp(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Run length
        <input
          type="number"
          min="0"
          step="any"
          value={length}
          onChange={(e) => setLength(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Run length unit
        <select value={unit} onChange={(e) => setUnit(e.target.value as RunSettings['runUnit'])}>
          <option value="shifts">shifts</option>
          <option value="hours">hours</option>
        </select>
      </label>
      <label className={styles.field}>
        Seed mode
        <select
          value={seedMode}
          onChange={(e) => setSeedMode(e.target.value as RunSettings['seedMode'])}
        >
          <option value="fixed">Fixed</option>
          <option value="random">Random each run</option>
        </select>
      </label>
      <label className={styles.field}>
        Seed
        <input type="number" step="1" value={seed} onChange={(e) => setSeed(e.target.value)} />
      </label>
      <Button variant="primary" onClick={apply}>
        Apply
      </Button>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </section>
  );
}

import { useState } from 'react';
import {
  BASE_EQUIPMENT_TYPES,
  EQUIPMENT_BEHAVIORS,
  defaultPorts,
  userEquipmentTypeSchema,
  type EquipmentBehavior,
  type EquipmentType,
  type Port,
} from '@factory-sim/schema';
import {
  formatNumber,
  fromDisplay,
  speedFromDisplay,
  speedToDisplay,
  toDisplay,
  type DisplayUnit,
} from '../layout/units';
import { PORT_SIDES, portAt, portOffset, portSide, type PortSide } from './portSides';

interface Props {
  unit: DisplayUnit;
  /** Present when editing: keeps the id so placed instances can find the type. */
  initial?: EquipmentType;
  onSave: (type: EquipmentType) => void;
  onCancel: () => void;
}

const BEHAVIOR_LABEL: Record<EquipmentBehavior, string> = {
  workstation: 'Workstation',
  buffer: 'Buffer / rack',
  conveyor: 'Conveyor',
  source: 'Source',
  sink: 'Sink',
};

const SIDE_LABEL: Record<PortSide, string> = {
  back: 'Back',
  front: 'Front',
  left: 'Left',
  right: 'Right',
};

interface PortDraft {
  id: string;
  kind: Port['kind'];
  side: PortSide;
  /** Percent of the edge, −50…50 from its center. */
  offset: string;
}

const toDraft = (p: Port): PortDraft => ({
  id: p.id,
  kind: p.kind,
  side: portSide(p),
  offset: String(Math.round(portOffset(p) * 1000) / 10),
});

const num = (t: string) => (t.trim() === '' ? NaN : Number(t));

/** Create or edit a library type: a base behavior plus name, size, color and default params. */
export function TypeEditor({ unit, initial, onSave, onCancel }: Props) {
  const seed = initial ?? BASE_EQUIPMENT_TYPES[0]!;
  const len = (m: number) => formatNumber(toDisplay(m, unit));
  const [behavior, setBehavior] = useState<EquipmentBehavior>(seed.behavior);
  const [name, setName] = useState(initial?.name ?? '');
  const [width, setWidth] = useState(len(seed.footprint.width));
  const [length, setLength] = useState(len(seed.footprint.length));
  const [height, setHeight] = useState(len(seed.height));
  const [color, setColor] = useState(seed.color);
  const p = seed.params as Record<string, unknown>;
  const [capacity, setCapacity] = useState(String(p.capacity ?? 1));
  const [batchSize, setBatchSize] = useState(String(p.batchSize ?? 1));
  const [speed, setSpeed] = useState(
    formatNumber(speedToDisplay(typeof p.speed === 'number' ? p.speed : 0.2, unit)),
  );
  // Ports follow the behavior; an unchanged behavior keeps the ports (and ids) it had.
  const [portDrafts, setPortDrafts] = useState<PortDraft[]>(seed.ports.map(toDraft));
  const [error, setError] = useState<string | null>(null);

  function save() {
    const sizes = [
      ['Width', num(width)],
      ['Length', num(length)],
      ['Height', num(height)],
    ] as const;
    if (name.trim() === '') return setError('Name is required');
    const bad = sizes.find(([, v]) => !(v > 0));
    if (bad) return setError(`${bad[0]} must be a number greater than 0`);
    if (portDrafts.some((d) => !(Math.abs(num(d.offset)) <= 50)))
      return setError('Port offset must be a number from −50 to 50 (% of the edge)');
    const params = paramsFor(behavior);
    if (typeof params === 'string') return setError(params);
    const draft = {
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      behavior,
      params,
      footprint: { width: fromDisplay(num(width), unit), length: fromDisplay(num(length), unit) },
      height: fromDisplay(num(height), unit),
      color,
      ports: portDrafts.map((d) => ({
        id: d.id,
        kind: d.kind,
        ...portAt(d.side, num(d.offset) / 100),
      })),
    };
    const parsed = userEquipmentTypeSchema.safeParse(draft);
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setError(null);
    onSave(parsed.data);
  }

  function paramsFor(b: EquipmentBehavior): Record<string, unknown> | string {
    if (b === 'workstation') {
      const labor = initial?.behavior === 'workstation' ? initial.params.labor : { mode: 'manual' };
      if (!Number.isInteger(num(capacity)) || num(capacity) < 1)
        return 'Capacity must be a whole number, 1 or more';
      if (!Number.isInteger(num(batchSize)) || num(batchSize) < 1)
        return 'Batch size must be a whole number, 1 or more';
      return { capacity: num(capacity), batchSize: num(batchSize), labor };
    }
    if (b === 'buffer') {
      return Number.isInteger(num(capacity)) && num(capacity) >= 1
        ? { capacity: num(capacity) }
        : 'Capacity must be a whole number, 1 or more';
    }
    if (b === 'conveyor')
      return num(speed) > 0
        ? { speed: speedFromDisplay(num(speed), unit) }
        : 'Speed must be greater than 0';
    return {};
  }

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {label}
      <input type="text" value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );

  return (
    <form
      aria-label={initial ? 'Edit equipment type' : 'New equipment type'}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      style={{ display: 'grid', gap: 8, margin: '8px 0' }}
    >
      {field('Name', name, setName)}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        Base behavior
        {/* A saved type's instances may be connected, routed or staffed; changing behavior would
            break those. Make a new type instead. */}
        <select
          value={behavior}
          disabled={initial !== undefined}
          onChange={(e) => {
            const b = e.target.value as EquipmentBehavior;
            setBehavior(b);
            setPortDrafts(defaultPorts(b).map(toDraft));
          }}
        >
          {EQUIPMENT_BEHAVIORS.map((b) => (
            <option key={b} value={b}>
              {BEHAVIOR_LABEL[b]}
            </option>
          ))}
        </select>
      </label>
      {field(`Width (${unit})`, width, setWidth)}
      {field(`Length (${unit})`, length, setLength)}
      {field(`Height (${unit})`, height, setHeight)}
      {field('Color', color, setColor)}
      {(behavior === 'workstation' || behavior === 'buffer') &&
        field('Capacity', capacity, setCapacity)}
      {behavior === 'workstation' && field('Batch size', batchSize, setBatchSize)}
      {behavior === 'conveyor' &&
        field(`Speed (${unit === 'ft' ? 'ft/min' : 'm/s'})`, speed, setSpeed)}
      {portDrafts.map((d, i) => {
        const label = d.kind === 'input' ? 'Input' : 'Output';
        const set = (patch: Partial<PortDraft>) =>
          setPortDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, ...patch } : x)));
        return (
          <div key={d.id} style={{ display: 'flex', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {label} port side
              <select value={d.side} onChange={(e) => set({ side: e.target.value as PortSide })}>
                {PORT_SIDES.map((s) => (
                  <option key={s} value={s}>
                    {SIDE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            {field(`${label} port offset (%)`, d.offset, (v) => set({ offset: v }))}
          </div>
        );
      })}
      {error && (
        <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit">Save type</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

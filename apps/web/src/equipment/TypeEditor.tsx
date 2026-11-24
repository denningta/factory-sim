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
import { ModelPreview } from './EquipmentModel';
import { defaultModelFor, modelsFor } from './models/registry';

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
  /** The port as loaded; kept as-is until the user edits this row, so the display rounding never alters it. */
  original: Port;
  edited: boolean;
}

const toDraft = (p: Port): PortDraft => ({
  id: p.id,
  kind: p.kind,
  side: portSide(p),
  offset: String(Math.round(portOffset(p) * 1000) / 10),
  original: p,
  edited: false,
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
  // '' = the behavior's default model; otherwise a registry id that suits the behavior.
  const [model, setModel] = useState(initial?.model ?? '');
  const p = seed.params as Record<string, unknown>;
  const [capacity, setCapacity] = useState(String(p.capacity ?? 1));
  const [batchSize, setBatchSize] = useState(String(p.batchSize ?? 1));
  const [speed, setSpeed] = useState(
    formatNumber(speedToDisplay(typeof p.speed === 'number' ? p.speed : 0.2, unit)),
  );
  // Drafts start from the type's ports (ids kept); changing the behavior of a new type resets them to its defaults.
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
    if (portDrafts.some((d) => d.edited && !(Math.abs(num(d.offset)) <= 50)))
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
      ...(model ? { model } : {}),
      ports: portDrafts.map((d) =>
        d.edited ? { id: d.id, kind: d.kind, ...portAt(d.side, num(d.offset) / 100) } : d.original,
      ),
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

  /** The draft as the preview draws it; unparseable sizes fall back to the seed's. */
  function previewType() {
    const m = (t: string, fallback: number) => {
      const v = fromDisplay(num(t), unit);
      return v > 0 ? v : fallback;
    };
    const params = paramsFor(behavior);
    return {
      behavior,
      params: typeof params === 'string' ? {} : params,
      footprint: { width: m(width, seed.footprint.width), length: m(length, seed.footprint.length) },
      height: m(height, seed.height),
      color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : seed.color,
      ...(model ? { model } : {}),
    } as Parameters<typeof ModelPreview>[0]['type'];
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
            setModel('');
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
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        3D model
        {/* Registry ids only (ADR-0015): a typed id could silently fall back to the default. */}
        <select value={model} onChange={(e) => setModel(e.target.value)}>
          <option value="">Behavior default ({defaultModelFor(behavior).label})</option>
          {modelsFor(behavior).map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <ModelPreview type={previewType()} label="3D model preview" />
      {(behavior === 'workstation' || behavior === 'buffer') &&
        field('Capacity', capacity, setCapacity)}
      {behavior === 'workstation' && field('Batch size', batchSize, setBatchSize)}
      {behavior === 'conveyor' &&
        field(`Speed (${unit === 'ft' ? 'ft/min' : 'm/s'})`, speed, setSpeed)}
      {portDrafts.map((d, i) => {
        const label = d.kind === 'input' ? 'Input' : 'Output';
        const set = (patch: Partial<PortDraft>) =>
          setPortDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, ...patch, edited: true } : x)));
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

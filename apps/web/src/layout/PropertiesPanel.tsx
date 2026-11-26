import { Fragment, useState } from 'react';
import { Button, Section } from '../ui';
import styles from './panels.module.css';
import { useEditorStore as defaultStore } from './editorStore';
import { Field, parseNumber } from './Field';
import { DurationEditor } from '../products/DurationEditor';
import { LaborEditor, StaffingEditor } from '../technicians/LaborEditor';
import { resolveModel } from '../equipment/models/registry';
import { BASE_EQUIPMENT_TYPES, type Connection, type Equipment } from '@factory-sim/schema';
import { portWorldPosition } from './ports';
import {
  formatLength,
  formatNumber,
  fromDisplay,
  speedFromDisplay,
  speedToDisplay,
  toDisplay,
} from './units';

type Store = typeof defaultStore;

const toDegrees = (rad: number) => (rad * 180) / Math.PI;

const PARAM_LABELS: Record<string, string> = {
  capacity: 'Capacity (units)',
  batchSize: 'Batch size (units)',
};

/** FL-2: how many parts can wait on a connection. Finite size is a positive integer. */
function ConnectionProperties({ useStore }: { useStore: Store }) {
  const {
    connections,
    equipment,
    unit,
    selectedConnectionId,
    updateConnection,
    beginEdit,
    endEdit,
  } = useStore();
  const conn = connections.find((c) => c.id === selectedConnectionId);
  if (!conn) return null;
  const mode = conn.capacity === null ? 'unlimited' : conn.capacity === 0 ? 'none' : 'finite';
  const pick = (m: 'none' | 'finite' | 'unlimited') => {
    if (m === 'none') updateConnection(conn.id, { capacity: 0 });
    if (m === 'unlimited') updateConnection(conn.id, { capacity: null });
    // Finite starts at 1 so the stored value always matches the radio; the user edits it next.
    if (m === 'finite' && mode !== 'finite') updateConnection(conn.id, { capacity: 1 });
  };
  const radio = (m: 'none' | 'finite' | 'unlimited', text: string) => (
    <label className={styles.choice}>
      <input type="radio" name="conn-capacity" checked={mode === m} onChange={() => pick(m)} />
      {text}
    </label>
  );
  return (
    <Section heading="Buffer & transfer" collapsible memoryKey="props-connection">
      <fieldset className={styles.choices}>
        <legend>Buffer on this connection</legend>
        {radio('none', 'No buffer (0)')}
        {radio('finite', 'Finite')}
        {radio('unlimited', 'Unlimited')}
      </fieldset>
      {mode === 'finite' && (
        <Field
          beginEdit={beginEdit}
          endEdit={endEdit}
          key={`cap-${conn.id}`}
          label="Buffer size (units)"
          value={String(conn.capacity)}
          commit={(t) => {
            const n = parseNumber(t);
            if (typeof n === 'string') return n;
            if (n < 1) return 'Enter a whole number, 1 or more';
            const r = updateConnection(conn.id, { capacity: n });
            return r.ok ? null : r.error;
          }}
        />
      )}
      {transferTime(conn, distanceOf(conn, equipment))}
    </Section>
  );

  // A plain function, not a component: a nested component would remount (and drop focus) per render.
  function transferTime(conn: Connection, distance: number | null) {
    const t = conn.transfer;
    const speedUnit = unit === 'ft' ? 'ft/min' : 'm/s';
    // Results are ignored: every value written here is valid by construction.
    const pickKind = (k: Connection['transfer']['kind']) => {
      if (k === t.kind) return;
      if (k === 'instant') updateConnection(conn.id, { transfer: { kind: 'instant' } });
      // Start from a valid value so the stored transfer always matches the radio.
      if (k === 'fixed')
        updateConnection(conn.id, {
          transfer: { kind: 'fixed', time: { kind: 'fixed', value: 1 } },
        });
      if (k === 'speed') updateConnection(conn.id, { transfer: { kind: 'speed', speed: 1 } });
    };
    const radio = (k: Connection['transfer']['kind'], text: string) => (
      <label className={styles.choice}>
        <input
          type="radio"
          name="conn-transfer"
          checked={t.kind === k}
          onChange={() => pickKind(k)}
        />
        {text}
      </label>
    );
    return (
      <>
        <fieldset className={styles.choices}>
          <legend>Transfer time</legend>
          {radio('instant', 'Instant')}
          {radio('fixed', 'Fixed time')}
          {radio('speed', 'From distance and speed')}
        </fieldset>
        {t.kind === 'fixed' && (
          <DurationEditor
            key={`tt-${conn.id}`}
            name="Transfer time"
            fixedLabel="Transfer time (s)"
            time={t.time}
            setTime={(d) => updateConnection(conn.id, { transfer: { kind: 'fixed', time: d } })}
            // A transfer always has a time, so clearing the field is ignored.
            setFixed={(seconds) =>
              seconds !== null &&
              updateConnection(conn.id, {
                transfer: { kind: 'fixed', time: { kind: 'fixed', value: seconds } },
              })
            }
            beginEdit={beginEdit}
            endEdit={endEdit}
          />
        )}
        {t.kind === 'speed' && (
          <>
            <Field
              beginEdit={beginEdit}
              endEdit={endEdit}
              key={`ts-${conn.id}`}
              label={`Speed (${speedUnit})`}
              value={formatNumber(speedToDisplay(t.speed, unit))}
              commit={(text) => {
                const n = parseNumber(text);
                if (typeof n === 'string') return n;
                const r = updateConnection(conn.id, {
                  transfer: { kind: 'speed', speed: speedFromDisplay(n, unit) },
                });
                return r.ok ? null : r.error;
              }}
            />
            {distance !== null && (
              <p className={styles.muted}>
                Distance {formatLength(distance, unit)} → {formatNumber(distance / t.speed)} s
              </p>
            )}
          </>
        )}
      </>
    );
  }
}

/** Port-to-port distance in meters, as the engine computes it; null if an end is missing. */
function distanceOf(conn: Connection, equipment: readonly Equipment[]): number | null {
  const at = (ref: Connection['from']) => {
    const e = equipment.find((q) => q.id === ref.equipmentId);
    const port = e?.ports.find((q) => q.id === ref.portId);
    return e && port ? portWorldPosition(e, port) : null;
  };
  const a = at(conn.from);
  const b = at(conn.to);
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
}

/** What the Process section says about this station's cycle times (ADR-0009: keyed by product + station). */
function CycleTimeSummary({
  stationId,
  useStore,
  onOpenProducts,
}: {
  stationId: string;
  useStore: Store;
  onOpenProducts?: () => void;
}) {
  const { cycleTimes, products } = useStore();
  const rows = cycleTimes.flatMap((c) => {
    const product = products.find((p) => p.id === c.productId);
    return c.stationId === stationId && product ? [{ product, time: c.time }] : [];
  });
  const text = (d: (typeof rows)[number]['time']) =>
    d.kind === 'fixed'
      ? `${formatNumber(d.value)} s`
      : `${formatNumber(d.kind === 'triangular' ? d.mode : d.mean)} s (${d.kind})`;
  return (
    <div className={styles.stack}>
      {rows.length === 0 ? (
        <p className={styles.muted}>No cycle times set for this station.</p>
      ) : (
        <dl className={styles.stack}>
          {rows.map((r) => (
            <div key={r.product.id} className={styles.readout}>
              <dt>{r.product.name}</dt>
              <dd>{text(r.time)}</dd>
            </div>
          ))}
        </dl>
      )}
      {onOpenProducts && (
        <button type="button" className={styles.linkButton} onClick={onOpenProducts}>
          Edit in Products &amp; routings
        </button>
      )}
    </div>
  );
}

export function PropertiesPanel({
  useStore = defaultStore,
  onOpenProducts,
}: {
  useStore?: Store;
  onOpenProducts?: () => void;
}) {
  const {
    equipment,
    selectedIds,
    userTypes,
    unit,
    rotateSelected,
    setSelectedRotation,
    updateEquipment,
    deleteSelected,
    beginEdit,
    endEdit,
    selectedConnectionId,
    technicians,
  } = useStore();
  /** Set when a params edit breaks a rule on another field, so both fields show the reason. */
  const [linked, setLinked] = useState<{ key: string; message: string } | null>(null);
  const selected = equipment.filter((e) => selectedIds.includes(e.id));
  const first = selected[0];
  // WS-4: techs assigned to the first selected station.
  const assigned = first ? technicians.filter((t) => t.stationIds.includes(first.id)).length : 0;
  if (!first && selectedConnectionId) return <ConnectionProperties useStore={useStore} />;
  // Nothing selected: the right panel shows floor and technician settings instead (RightPanel).
  if (!first) return null;
  const single = selected.length === 1;
  const same = selected.every((e) => e.rotation === first.rotation);
  const pos = (m: number) => formatNumber(toDisplay(m, unit));
  const type = [...BASE_EQUIPMENT_TYPES, ...userTypes].find((t) => t.id === first.typeId);
  // Keyed by selection so the field re-reads when the selection changes.
  const rotation = (
    <>
      <Field
        beginEdit={beginEdit}
        endEdit={endEdit}
        key={`rot-${selectedIds.join(',')}`}
        label="Rotation (°)"
        value={same ? formatNumber(toDegrees(first.rotation)) : ''}
        placeholder={same ? undefined : 'Mixed'}
        commit={(t) => {
          const n = parseNumber(t);
          if (typeof n === 'string') return n;
          setSelectedRotation(n);
          return null;
        }}
      />
      <div className={styles.row}>
        <Button onClick={() => rotateSelected(-90)}>Rotate −90°</Button>
        <Button onClick={() => rotateSelected(90)}>Rotate 90°</Button>
      </div>
    </>
  );
  const remove = (
    <Button variant="danger" onClick={deleteSelected}>
      Delete
    </Button>
  );
  if (!single)
    return (
      <div className={styles.panel}>
        <Section heading="Selection" collapsible memoryKey="props-selection">
          <p>
            <strong>{`${selected.length} selected`}</strong>
          </p>
          {rotation}
          {remove}
        </Section>
      </div>
    );
  return (
    <div className={styles.panel}>
      <Section heading="General" collapsible memoryKey="props-general">
        <Field
          beginEdit={beginEdit}
          endEdit={endEdit}
          key={`name-${first.id}`}
          label="Name"
          value={first.name}
          commit={(t) => {
            const r = updateEquipment(first.id, { name: t });
            return r.ok ? null : r.error;
          }}
        />
        <dl className={styles.stack}>
          <div className={styles.readout}>
            <dt>Type</dt>
            <dd data-testid="type">{type?.name ?? first.typeId}</dd>
          </div>
          <div className={styles.readout}>
            <dt>Model</dt>
            <dd data-testid="model">{resolveModel(first).label}</dd>
          </div>
        </dl>
      </Section>
      <Section heading="Size & position" collapsible memoryKey="props-size">
        <div className={styles.row}>
          {(
            [
              ['Length', first.footprint.length, (m: number) => ({ footprint: { length: m } })],
              ['Width', first.footprint.width, (m: number) => ({ footprint: { width: m } })],
              ['Height', first.height, (m: number) => ({ height: m })],
            ] as const
          ).map(([label, meters, patchOf]) => (
            <Field
              beginEdit={beginEdit}
              endEdit={endEdit}
              key={`${label}-${first.id}`}
              label={`${label} (${unit})`}
              value={pos(meters)}
              commit={(t) => {
                const n = parseNumber(t);
                if (typeof n === 'string') return n;
                const r = updateEquipment(first.id, patchOf(fromDisplay(n, unit)));
                return r.ok ? null : r.error;
              }}
            />
          ))}
        </div>
        <div className={styles.row}>
          {(['x', 'y'] as const).map((axis) => (
            <Field
              beginEdit={beginEdit}
              endEdit={endEdit}
              key={`${axis}-${first.id}`}
              label={`Position ${axis.toUpperCase()} (${unit})`}
              value={pos(first.position[axis])}
              commit={(t) => {
                const n = parseNumber(t);
                if (typeof n === 'string') return n;
                const r = updateEquipment(first.id, {
                  position: { [axis]: fromDisplay(n, unit) },
                });
                if (r.ok) return null;
                // The store words bounds in meters; say it in the display unit.
                return r.bounds
                  ? `${axis.toUpperCase()} must be on the floor (0 to ${formatLength(r.bounds.max, unit)})`
                  : r.error;
              }}
            />
          ))}
        </div>
        {rotation}
      </Section>
      <Section heading="Process" collapsible memoryKey="props-process">
        {/* Numeric params only; labor (TE-1) has its own editor below. */}
        {Object.entries(first.params)
          .flatMap(([key, v]) => (typeof v === 'number' ? [[key, v] as const] : []))
          .map(([key, v]) => {
            const isSpeed = key === 'speed';
            const techLimited =
              key === 'capacity' &&
              first.behavior === 'workstation' &&
              first.params.labor.mode === 'manual' &&
              v > assigned;
            return (
              <Fragment key={`${key}-${first.id}`}>
                <Field
                  beginEdit={beginEdit}
                  describedBy={techLimited ? 'tech-limit-hint' : undefined}
                  endEdit={endEdit}
                  label={
                    isSpeed
                      ? `Speed (${unit === 'ft' ? 'ft/min' : 'm/s'})`
                      : (PARAM_LABELS[key] ?? key)
                  }
                  value={isSpeed ? formatNumber(speedToDisplay(v, unit)) : String(v)}
                  commit={(t) => {
                    const parsed = parseNumber(t);
                    if (typeof parsed === 'string') return parsed;
                    const n = isSpeed ? speedFromDisplay(parsed, unit) : parsed;
                    const r = updateEquipment(first.id, { params: { [key]: n } });
                    setLinked(
                      !r.ok && r.field && r.field !== key
                        ? { key: r.field, message: r.error }
                        : null,
                    );
                    return r.ok ? null : r.error;
                  }}
                  extraError={linked?.key === key ? linked.message : null}
                  onBlur={() => setLinked(null)}
                />
                {techLimited && (
                  <p id="tech-limit-hint" className={styles.warn}>
                    {`Parallel units limited by assigned techs (${assigned})`}
                  </p>
                )}
              </Fragment>
            );
          })}
        {first.behavior === 'workstation' && (
          <>
            <LaborEditor equipmentId={first.id} useStore={useStore} />
            <CycleTimeSummary
              stationId={first.id}
              useStore={useStore}
              {...(onOpenProducts ? { onOpenProducts } : {})}
            />
          </>
        )}
      </Section>
      {first.behavior === 'workstation' && (
        <Section heading="Staffing" collapsible memoryKey="props-staffing">
          <StaffingEditor equipmentId={first.id} useStore={useStore} />
        </Section>
      )}
      {remove}
    </div>
  );
}

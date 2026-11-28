import { useMemo, useRef } from 'react';
import type { Product } from '@factory-sim/schema';
import { useEditorStore as defaultStore } from '../layout/editorStore';
import { Button } from '../ui';
import { reachableFromSources } from './reachability';
import styles from './products.module.css';

type Store = typeof defaultStore;

/** Wireframe 2, "Routing — <product>": the product's ordered operations (PR-2). */
export function RoutingEditor({
  product,
  useStore = defaultStore,
}: {
  product: Product;
  useStore?: Store;
}) {
  const equipment = useStore((s) => s.equipment);
  const connections = useStore((s) => s.connections);
  const addRoutingStep = useStore((s) => s.addRoutingStep);
  const setRoutingStepStation = useStore((s) => s.setRoutingStepStation);
  const moveRoutingStep = useStore((s) => s.moveRoutingStep);
  const removeRoutingStep = useStore((s) => s.removeRoutingStep);
  const addRoutingAlternate = useStore((s) => s.addRoutingAlternate);
  const removeRoutingAlternate = useStore((s) => s.removeRoutingAlternate);
  const stations = equipment.filter((e) => e.behavior === 'workstation');
  const reachable = useMemo(
    () => reachableFromSources({ equipment, connections }),
    [equipment, connections],
  );
  // Which step is being dragged; a ref, since nothing re-renders off it.
  const dragging = useRef<string | null>(null);
  const steps = product.routing;

  return (
    <section aria-labelledby="routing-heading" className={styles.routing}>
      <div className={styles.routingHead}>
        <h2 id="routing-heading" className={styles.h2}>
          Routing — {product.name}
        </h2>
        {steps.length > 1 && <span className={styles.hint}>Drag to reorder</span>}
      </div>
      {stations.length === 0 && (
        <p className={styles.warning}>
          Place a workstation on the Layout first; each step runs at a workstation.
        </p>
      )}
      <ol aria-label="Routing steps" className={styles.steps}>
        {steps.map((step, i) => {
          const n = i + 1;
          const alternates = step.alternates ?? [];
          const nameOf = (id: string) => equipment.find((e) => e.id === id)?.name ?? id;
          const unreachable = !reachable.has(step.stationId);
          const unreachableAlts = alternates.filter((a) => !reachable.has(a));
          // Workstations that could still join this step.
          const candidates = stations
            .filter((st) => st.id !== step.stationId && !alternates.includes(st.id))
            // A twin of the primary's type is the likeliest intent.
            .sort((a, b) => {
              const type = equipment.find((e) => e.id === step.stationId)?.typeId;
              return Number(b.typeId === type) - Number(a.typeId === type);
            });
          return (
            <li
              key={step.id}
              draggable
              onDragStart={(e) => {
                dragging.current = step.id;
                // Firefox only starts a drag when it carries data.
                e.dataTransfer?.setData('text/plain', step.id);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging.current) moveRoutingStep(product.id, dragging.current, i);
                dragging.current = null;
              }}
              onDragEnd={() => (dragging.current = null)}
              className={unreachable || unreachableAlts.length > 0 ? styles.stepWarn : styles.step}
            >
              <span aria-hidden className={styles.grip}>
                ⋮⋮
              </span>
              <span aria-hidden className={styles.stepNumber}>
                {n}
              </span>
              <span aria-hidden className={styles.muted}>
                →
              </span>
              <select
                aria-label={`Station for step ${n}`}
                value={step.stationId}
                onChange={(e) => setRoutingStepStation(product.id, step.id, e.target.value)}
                className={styles.stationSelect}
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {alternates.map((a) => (
                <span key={a} className={styles.alternate}>
                  <span className={styles.muted}>or</span>
                  <span>{nameOf(a)}</span>
                  <button
                    type="button"
                    aria-label={`Remove parallel station ${nameOf(a)}`}
                    onClick={() => removeRoutingAlternate(product.id, step.id, a)}
                    className={styles.iconButton}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                disabled={candidates.length === 0}
                onClick={() => addRoutingAlternate(product.id, step.id, candidates[0]!.id)}
                className={styles.linkButton}
              >
                + Parallel station
              </button>
              {(unreachable || unreachableAlts.length > 0) && (
                <span className={styles.warningSmall}>
                  ⚠ Not reachable from a source:{' '}
                  {[...(unreachable ? [step.stationId] : []), ...unreachableAlts]
                    .map(nameOf)
                    .join(', ')}
                  . Connect on the Layout
                </span>
              )}
              <span className={styles.stepActions}>
                <button
                  type="button"
                  aria-label={`Move step ${n} up`}
                  disabled={i === 0}
                  onClick={() => moveRoutingStep(product.id, step.id, i - 1)}
                  className={styles.iconButton}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move step ${n} down`}
                  disabled={i === steps.length - 1}
                  onClick={() => moveRoutingStep(product.id, step.id, i + 1)}
                  className={styles.iconButton}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Remove step ${n}`}
                  onClick={() => removeRoutingStep(product.id, step.id)}
                  className={styles.iconButton}
                >
                  ×
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <div>
        <Button
          disabled={stations.length === 0}
          onClick={() => addRoutingStep(product.id, stations[0]!.id)}
        >
          + Add step
        </Button>
      </div>
    </section>
  );
}

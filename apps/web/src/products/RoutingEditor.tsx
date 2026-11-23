import { useMemo, useRef } from 'react';
import type { Product } from '@factory-sim/schema';
import { useEditorStore as defaultStore } from '../layout/editorStore';
import { reachableFromSources } from './reachability';

type Store = typeof defaultStore;

const iconButton = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: '#6b7280',
  padding: '2px 6px',
} as const;

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
  const stations = equipment.filter((e) => e.behavior === 'workstation');
  const reachable = useMemo(
    () => reachableFromSources({ equipment, connections }),
    [equipment, connections],
  );
  // Which step is being dragged; a ref, since nothing re-renders off it.
  const dragging = useRef<string | null>(null);
  const steps = product.routing;

  return (
    <section aria-labelledby="routing-heading" style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 id="routing-heading" style={{ fontSize: 18, margin: 0 }}>
          Routing — {product.name}
        </h2>
        {steps.length > 1 && (
          <span style={{ color: '#6b7280', fontSize: 12 }}>Drag to reorder</span>
        )}
      </div>
      {stations.length === 0 && (
        <p style={{ color: '#b45309', margin: 0 }}>
          Place a workstation on the Layout first; each step runs at a workstation.
        </p>
      )}
      <ol
        aria-label="Routing steps"
        style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}
      >
        {steps.map((step, i) => {
          const n = i + 1;
          const unreachable = !reachable.has(step.stationId);
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: 'white',
                border: `1px solid ${unreachable ? '#f59e0b' : '#e5e7eb'}`,
                borderRadius: 8,
              }}
            >
              <span aria-hidden style={{ cursor: 'grab', color: '#9ca3af' }}>
                ⋮⋮
              </span>
              <span
                aria-hidden
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: '#f3f4f6',
                  display: 'inline-grid',
                  placeItems: 'center',
                  fontSize: 12,
                }}
              >
                {n}
              </span>
              <span aria-hidden style={{ color: '#6b7280' }}>
                →
              </span>
              <select
                aria-label={`Station for step ${n}`}
                value={step.stationId}
                onChange={(e) => setRoutingStepStation(product.id, step.id, e.target.value)}
                style={{ minWidth: 180, padding: 4 }}
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {unreachable && (
                <span style={{ color: '#b45309', fontSize: 12 }}>
                  ⚠ Not reachable from a source: connect this station on the Layout
                </span>
              )}
              <span style={{ marginLeft: 'auto', display: 'flex' }}>
                <button
                  aria-label={`Move step ${n} up`}
                  disabled={i === 0}
                  onClick={() => moveRoutingStep(product.id, step.id, i - 1)}
                  style={iconButton}
                >
                  ↑
                </button>
                <button
                  aria-label={`Move step ${n} down`}
                  disabled={i === steps.length - 1}
                  onClick={() => moveRoutingStep(product.id, step.id, i + 1)}
                  style={iconButton}
                >
                  ↓
                </button>
                <button
                  aria-label={`Remove step ${n}`}
                  onClick={() => removeRoutingStep(product.id, step.id)}
                  style={iconButton}
                >
                  ×
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <div>
        <button
          disabled={stations.length === 0}
          onClick={() => addRoutingStep(product.id, stations[0]!.id)}
          style={{ padding: '6px 12px' }}
        >
          + Add step
        </button>
      </div>
    </section>
  );
}

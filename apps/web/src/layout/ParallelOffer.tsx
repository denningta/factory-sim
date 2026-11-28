import { useEditorStore as defaultStore } from './editorStore';
import { Button } from '../ui';
import styles from './ParallelOffer.module.css';

/**
 * After connecting one output to a second station of the same type as a routed one, asks whether
 * the new station is a parallel twin (PS-2, ADR-0018). Floats over the floor, bottom centre.
 */
export function ParallelOffer({ useStore = defaultStore }: { useStore?: typeof defaultStore }) {
  const offer = useStore((s) => s.parallelOffer);
  const accept = useStore((s) => s.acceptParallelOffer);
  const dismiss = useStore((s) => s.dismissParallelOffer);
  const station = useStore((s) => s.equipment.find((e) => e.id === offer?.stationId));
  const primary = useStore((s) => s.equipment.find((e) => e.id === offer?.primaryId));
  if (!offer || !station || !primary) return null;
  return (
    <div role="group" aria-label="Parallel station" className={styles.offer}>
      <div>
        <p className={styles.detail}>
          {station.name} is the same type as {primary.name}.
        </p>
        <p className={styles.question}>Use as parallel station for {offer.label}?</p>
      </div>
      <Button variant="primary" onClick={accept}>
        Use as parallel
      </Button>
      <Button onClick={dismiss}>Not now</Button>
    </div>
  );
}

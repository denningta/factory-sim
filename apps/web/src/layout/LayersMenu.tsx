import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui';
import { useLayersStore } from './layersStore';
import styles from './LayersMenu.module.css';

/** Viewport toolbar menu of what the 3D scene draws; shared by the editor and Simulate. */
export function LayersMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const connections = useLayersStore((s) => s.connections);
  const shadows = useLayersStore((s) => s.shadows);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={root} className={styles.root}>
      <Button
        aria-haspopup="menu"
        aria-expanded={open}
        title="Choose what the scene shows"
        onClick={() => setOpen((o) => !o)}
      >
        Layers
      </Button>
      {open && (
        <div role="menu" aria-label="Layers" className={styles.menu}>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={connections}
            className={styles.item}
            onClick={() => useLayersStore.getState().setConnections(!connections)}
          >
            <span className={styles.tick} aria-hidden="true">
              {connections ? '✓' : ''}
            </span>
            Connections
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={shadows}
            className={styles.item}
            onClick={() => useLayersStore.getState().setShadows(!shadows)}
          >
            <span className={styles.tick} aria-hidden="true">
              {shadows ? '✓' : ''}
            </span>
            Shadows
          </button>
        </div>
      )}
    </div>
  );
}

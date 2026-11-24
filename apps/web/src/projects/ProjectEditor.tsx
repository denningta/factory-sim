import { useEffect, useRef, useState } from 'react';
import type { Project } from '@factory-sim/schema';
import { api, type ApiRequestError } from '../api/client';
import { SignIn } from '../auth/SignIn';
import { Button } from '../ui';
import { Editor } from '../Editor';
import { SimulateScreen } from '../simulation/SimulateScreen';
import { ProductsPanel } from '../products/ProductsPanel';
import { useEditorStore } from '../layout/editorStore';
import { useUndoShortcuts } from '../layout/shortcuts';
import { createAutosaver, type SaveStatus } from './autosave';
import { documentForSave } from './document';
import styles from './projects.module.css';

const AUTOSAVE_MS = 2000; // well inside the 5 s requirement, leaves room for the request

const LABEL: Record<Exclude<SaveStatus, 'stopped'>, string> = {
  signin: 'Session expired. Sign in to save your changes.',
  saved: 'All changes saved',
  unsaved: 'Unsaved changes…',
  saving: 'Saving…',
  error: 'Save failed, retrying…',
  conflict:
    'This project was changed elsewhere. Reload to continue; your latest edits are not saved.',
};

/** Loads a project into the editor store and autosaves floor/equipment changes back to it. */
export function ProjectEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [stop, setStop] = useState<ApiRequestError | null>(null);
  const saverRef = useRef<ReturnType<typeof createAutosaver> | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<'layout' | 'products' | 'simulate'>('layout');

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    let saver: ReturnType<typeof createAutosaver> | undefined;
    setReady(false);
    api.getProject(id).then(
      (p) => {
        if (cancelled) return;
        let revision = p.revision;
        let base: Project = p.document;
        useEditorStore.getState().loadDocument(base);
        setName(p.name);
        saver = saverRef.current = createAutosaver({
          delayMs: AUTOSAVE_MS,
          maxWaitMs: 4000,
          onStatus: (s, err) => {
            setStatus(s);
            setStop(s === 'stopped' || s === 'conflict' ? (err ?? null) : null);
          },
          save: async () => {
            const {
              floor,
              equipment,
              products,
              connections,
              cycleTimes,
              technicians,
              demand,
              release,
              shiftLength,
              run,
              clearance,
            } = useEditorStore.getState();
            const document = documentForSave(base, {
              floor,
              equipment,
              products,
              connections,
              cycleTimes,
              technicians,
              demand,
              release,
              shiftLength,
              run,
              minClearance: clearance,
            });
            const saved = await api.updateProject(id, { document, baseRevision: revision });
            revision = saved.revision;
            base = document;
          },
        });
        unsubscribe = useEditorStore.subscribe((s, prev) => {
          if (
            s.floor !== prev.floor ||
            s.equipment !== prev.equipment ||
            s.products !== prev.products ||
            s.connections !== prev.connections ||
            s.cycleTimes !== prev.cycleTimes ||
            s.technicians !== prev.technicians ||
            s.demand !== prev.demand ||
            s.release !== prev.release ||
            s.shiftLength !== prev.shiftLength ||
            s.run !== prev.run ||
            s.clearance !== prev.clearance
          )
            saver?.markDirty();
        });
        setReady(true);
      },
      (e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : 'Cannot open'),
    );
    return () => {
      cancelled = true;
      unsubscribe();
      void saver?.flush().finally(() => saver?.dispose());
    };
  }, [id]);

  // Closing the tab inside the debounce window would lose the last edits.
  const unsaved =
    status === 'unsaved' || status === 'saving' || status === 'error' || status === 'signin';
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const locked = status === 'stopped' || status === 'conflict';
  useUndoShortcuts(locked);

  if (loadError)
    return (
      <p role="alert">
        {loadError} <Button onClick={onClose}>Back</Button>
      </p>
    );
  if (!ready) return <p className={styles.opening}>Opening…</p>;
  return (
    <div className={styles.root}>
      {/* One inert container (header + editor) keeps focus and clicks inside the dialog. */}
      <div inert={status === 'signin'} className={styles.frame}>
        <header className={styles.header}>
          <Button onClick={onClose}>← Projects</Button>
          <strong>{name}</strong>
          <nav aria-label="Screens" className={styles.nav}>
            {(['layout', 'products', 'simulate'] as const).map((t) => (
              <Button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
                {t === 'layout' ? 'Layout' : t === 'products' ? 'Products' : 'Simulate'}
              </Button>
            ))}
          </nav>
          <span
            role="status"
            className={
              status === 'conflict' || status === 'error' || status === 'stopped'
                ? styles.statusBad
                : styles.status
            }
          >
            {status === 'stopped'
              ? `Not saved: ${stop?.message ?? 'saving stopped'}`
              : LABEL[status]}
          </span>
          {(status === 'conflict' || status === 'stopped') && (
            <Button onClick={() => location.reload()}>Reload</Button>
          )}
        </header>
        {/* After saving has stopped, further edits could never be saved, so lock the editor. */}
        <div inert={locked} className={locked ? styles.bodyLocked : styles.body}>
          {tab === 'layout' ? (
            <Editor readOnly={locked} />
          ) : tab === 'products' ? (
            <ProductsPanel />
          ) : (
            <SimulateScreen onNavigate={setTab} />
          )}
        </div>
      </div>
      {status === 'signin' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Session expired"
          className={styles.overlay}
        >
          <div className={styles.dialog}>
            <p className={styles.dialogText}>
              Your session expired. Sign in to save your changes; nothing has been lost.
            </p>
            <SignIn compact needsSetup={false} onSignedIn={() => saverRef.current?.resume()} />
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { Project } from '@factory-sim/schema';
import { api, type ApiRequestError } from '../api/client';
import { Editor } from '../Editor';
import { useEditorStore } from '../layout/editorStore';
import { createAutosaver, type SaveStatus } from './autosave';

const AUTOSAVE_MS = 2000; // well inside the 5 s requirement, leaves room for the request

const LABEL: Record<Exclude<SaveStatus, 'stopped'>, string> = {
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    let saver: ReturnType<typeof createAutosaver> | undefined;
    setReady(false);
    api.getProject(id).then(
      (p) => {
        if (cancelled) return;
        let revision = p.revision;
        // Products, routings etc. aren't edited yet; carry them through unchanged.
        let base: Project = p.document;
        useEditorStore.getState().loadDocument(base);
        setName(p.name);
        saver = createAutosaver({
          delayMs: AUTOSAVE_MS,
          maxWaitMs: 4000,
          onStatus: (s, err) => {
            setStatus(s);
            setStop(s === 'stopped' || s === 'conflict' ? (err ?? null) : null);
          },
          save: async () => {
            const { floor, equipment } = useEditorStore.getState();
            const document = { ...base, floor, equipment };
            const saved = await api.updateProject(id, { document, baseRevision: revision });
            revision = saved.revision;
            base = document;
          },
        });
        unsubscribe = useEditorStore.subscribe((s, prev) => {
          if (s.floor !== prev.floor || s.equipment !== prev.equipment) saver?.markDirty();
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
  const unsaved = status !== 'saved';
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  if (loadError)
    return (
      <p role="alert">
        {loadError} <button onClick={onClose}>Back</button>
      </p>
    );
  if (!ready) return <p style={{ font: '14px sans-serif', padding: 16 }}>Opening…</p>;
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', height: '100vh' }}>
      <header style={{ display: 'flex', gap: 12, padding: '6px 12px', font: '14px sans-serif' }}>
        <button onClick={onClose}>← Projects</button>
        <strong>{name}</strong>
        <span
          role="status"
          style={{
            marginLeft: 'auto',
            color:
              status === 'conflict' || status === 'error' || status === 'stopped'
                ? '#b91c1c'
                : '#6b7280',
          }}
        >
          {status === 'stopped' ? `Not saved: ${stop?.message ?? 'saving stopped'}` : LABEL[status]}
        </span>
        {(status === 'conflict' || status === 'stopped') && (
          <button onClick={() => location.reload()}>
            {stop?.code === 'unauthorized' ? 'Sign in' : 'Reload'}
          </button>
        )}
      </header>
      <Editor />
    </div>
  );
}

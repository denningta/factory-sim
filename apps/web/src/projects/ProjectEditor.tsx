import { useEffect, useState } from 'react';
import type { Project } from '@factory-sim/schema';
import { api } from '../api/client';
import { Editor } from '../Editor';
import { useEditorStore } from '../layout/editorStore';
import { createAutosaver, type SaveStatus } from './autosave';

const AUTOSAVE_MS = 2000; // well inside the 5 s requirement, leaves room for the request

const LABEL: Record<SaveStatus, string> = {
  saved: 'All changes saved',
  unsaved: 'Unsaved changes…',
  saving: 'Saving…',
  error: 'Save failed, retrying…',
  stopped: 'Saving stopped.',
  conflict:
    'This project was changed elsewhere. Reload to continue; your latest edits are not saved.',
};

/** Loads a project into the editor store and autosaves floor/equipment changes back to it. */
export function ProjectEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<SaveStatus>('saved');
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
          onStatus: setStatus,
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
          style={{ color: status === 'conflict' || status === 'error' ? '#b91c1c' : '#6b7280' }}
        >
          {LABEL[status]}
        </span>
        {status === 'conflict' && <button onClick={() => location.reload()}>Reload</button>}
      </header>
      <Editor />
    </div>
  );
}

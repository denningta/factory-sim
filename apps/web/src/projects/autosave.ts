import { ApiRequestError } from '../api/client';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict' | 'stopped';

export interface Autosaver {
  markDirty: () => void;
  flush: () => Promise<void>;
  dispose: () => void;
}

/**
 * Debounced saver: saves `delayMs` after the last change. A failed save retries after the same
 * delay; a conflict stops saving so the newer server copy is never overwritten.
 */
export function createAutosaver(opts: {
  save: () => Promise<void>;
  delayMs: number;
  maxWaitMs: number;
  onStatus: (s: SaveStatus, err?: ApiRequestError) => void;
}): Autosaver {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  let saving: Promise<void> | undefined;
  let stopped = false;

  // When the oldest unsaved change was made; bounds the debounce so continuous editing still saves.
  let firstDirtyAt = 0;

  const schedule = () => {
    clearTimeout(timer);
    const remaining = firstDirtyAt + opts.maxWaitMs - Date.now();
    timer = setTimeout(() => void run(), Math.max(0, Math.min(opts.delayMs, remaining)));
  };

  const run = async (): Promise<void> => {
    clearTimeout(timer);
    if (stopped) return;
    if (saving) return saving; // the in-flight save re-runs if dirty when it finishes
    if (!dirty) return;
    dirty = false;
    firstDirtyAt = 0;
    opts.onStatus('saving');
    saving = opts
      .save()
      .then(() => {
        opts.onStatus(dirty ? 'unsaved' : 'saved');
      })
      .catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.code === 'conflict') {
          stopped = true;
          opts.onStatus('conflict', err);
          return;
        }
        // Network trouble and server faults may pass; anything else (stale app, expired session,
        // deleted project, too large) would fail the same way every time, so tell the user.
        if (err instanceof ApiRequestError && err.code !== 'internal') {
          stopped = true;
          opts.onStatus('stopped', err);
          return;
        }
        dirty = true;
        firstDirtyAt ||= Date.now();
        opts.onStatus('error');
      })
      .finally(() => {
        saving = undefined;
        if (dirty && !stopped) schedule();
      });
    return saving;
  };

  return {
    markDirty: () => {
      if (stopped) return;
      dirty = true;
      if (!firstDirtyAt) firstDirtyAt = Date.now();
      opts.onStatus('unsaved');
      if (!saving) schedule();
    },
    flush: run,
    dispose: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';

export interface Autosaver {
  markDirty: () => void;
  flush: () => Promise<void>;
  dispose: () => void;
}

export function createAutosaver(_opts: {
  save: () => Promise<void>;
  delayMs: number;
  onStatus: (s: SaveStatus) => void;
}): Autosaver {
  throw new Error('not implemented');
}

import { useEditorStore as defaultStore } from '../layout/editorStore';

type Store = typeof defaultStore;

/** Wireframe 2, "Cycle times": product × station grid (PR-3). */
export function CycleTimeGrid({ useStore: _useStore = defaultStore }: { useStore?: Store }) {
  return null;
}

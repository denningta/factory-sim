import { useEffect } from 'react';
import { useEditorStore } from './editorStore';

const isTextTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName);

/**
 * Undo and redo (Ctrl/Cmd+Z, Shift+Z, Y). Registered once at project level so they work on every
 * screen, since the history covers all of them. Ignored while a text field has focus.
 */
export function useUndoShortcuts(readOnly: boolean): void {
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTextTarget(e.target) || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      const store = useEditorStore.getState();
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        return e.shiftKey ? store.redo() : store.undo();
      }
      if (k === 'y') {
        e.preventDefault();
        return store.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);
}

/**
 * Layout-screen keyboard shortcuts (delete and clear selection; undo is `useUndoShortcuts`). Ignored while a text field has focus so the browser's own field
 * undo keeps working there.
 */
export function useEditorShortcuts(readOnly: boolean): void {
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTextTarget(e.target)) return;
      const store = useEditorStore.getState();
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === 'Delete' || e.key === 'Backspace') store.deleteSelected();
      if (e.key === 'Escape') store.clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);
}

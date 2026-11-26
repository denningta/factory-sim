import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FloorEmptyHint } from './FloorEmptyHint';
import { createEditorStore } from './editorStore';

afterEach(cleanup);

describe('UI-3 AC5: empty states give the next action', () => {
  it('empty floor says to drag a type from the library', () => {
    const store = createEditorStore();
    render(<FloorEmptyHint useStore={store} />);
    expect(screen.getByText('Drag a type from the library onto the floor')).toBeTruthy();
  });

  it('goes away once something is placed', () => {
    const store = createEditorStore();
    store.getState().placeEquipment('base-workstation', { x: 5, y: 5 });
    render(<FloorEmptyHint useStore={store} />);
    expect(screen.queryByText(/drag a type/i)).toBeNull();
  });
});

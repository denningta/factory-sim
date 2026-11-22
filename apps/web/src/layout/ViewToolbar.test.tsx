import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewToolbar } from './ViewToolbar';
import { createEditorStore } from './editorStore';

afterEach(cleanup);

describe('ViewToolbar', () => {
  it('"Zoom to fit" requests a camera refit (replaces auto-refit, #57)', async () => {
    const store = createEditorStore();
    render(<ViewToolbar useStore={store} />);
    await userEvent.setup().click(await screen.findByRole('button', { name: /zoom to fit/i }));
    expect(store.getState().fitTick).toBe(1);
  });
});

describe('One click toggles an orthographic top-down view', () => {
  it('one click on the view button switches 3D → 2D and a second click switches back', async () => {
    const store = createEditorStore();
    render(<ViewToolbar useStore={store} />);
    const user = userEvent.setup();
    expect(store.getState().viewMode).toBe('3d');
    await user.click(await screen.findByRole('button', { name: /2d top-down/i }));
    expect(store.getState().viewMode).toBe('2d');
    await user.click(await screen.findByRole('button', { name: /3d view/i }));
    expect(store.getState().viewMode).toBe('3d');
  });
});

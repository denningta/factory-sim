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
  it('a segmented 3D | 2D top-down control marks the current view with aria-pressed', async () => {
    const store = createEditorStore();
    render(<ViewToolbar useStore={store} />);
    const d3 = await screen.findByRole('button', { name: '3D' });
    const d2 = await screen.findByRole('button', { name: /2d top-down/i });
    expect(d3.getAttribute('aria-pressed')).toBe('true');
    expect(d2.getAttribute('aria-pressed')).toBe('false');
    const user = userEvent.setup();
    await user.click(d2);
    expect(store.getState().viewMode).toBe('2d');
    expect(d2.getAttribute('aria-pressed')).toBe('true');
    expect(d3.getAttribute('aria-pressed')).toBe('false');
    await user.click(d2); // the active segment doesn't flip back
    expect(store.getState().viewMode).toBe('2d');
    await user.click(d3);
    expect(store.getState().viewMode).toBe('3d');
  });
});

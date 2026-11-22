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

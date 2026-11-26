import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayersMenu } from './LayersMenu';
import { ViewToolbar } from './ViewToolbar';
import { useLayersStore } from './layersStore';

afterEach(() => {
  cleanup();
  localStorage.clear();
  useLayersStore.setState({ connections: true });
});

describe('SF-3 AC4: Layers menu', () => {
  it('opens a menu with a Connections toggle, on by default, that hides and shows the layer', async () => {
    render(<LayersMenu />);
    await userEvent.click(screen.getByRole('button', { name: 'Layers' }));
    const box = screen.getByRole('menuitemcheckbox', { name: 'Connections' });
    expect(box.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(box);
    expect(useLayersStore.getState().connections).toBe(false);
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Connections' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('is in the editor viewport toolbar', () => {
    render(<ViewToolbar />);
    expect(screen.getByRole('button', { name: 'Layers' })).toBeTruthy();
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TechniciansPanel } from './TechniciansPanel';
import { createEditorStore } from '../layout/editorStore';

afterEach(cleanup);

describe('UI-3 AC5: technicians empty state', () => {
  it('says to add a technician, then assign stations', () => {
    render(<TechniciansPanel useStore={createEditorStore()} />);
    expect(screen.getByText('Add a technician, then assign stations')).toBeTruthy();
  });

  it('goes away once a technician exists', () => {
    const store = createEditorStore();
    store.getState().addTechnician();
    render(<TechniciansPanel useStore={store} />);
    expect(screen.queryByText(/then assign stations/i)).toBeNull();
  });
});

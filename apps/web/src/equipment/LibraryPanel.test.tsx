import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BASE_EQUIPMENT_TYPES } from '@factory-sim/schema';
import { LibraryPanel } from './LibraryPanel';

afterEach(cleanup);

describe('LibraryPanel', () => {
  it('lists workstation, buffer/rack, conveyor, source and sink', () => {
    render(<LibraryPanel unit="m" selectedId={null} onSelect={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    const text = items.map((i) => i.textContent ?? '').join('|');
    for (const name of [/workstation/i, /buffer/i, /conveyor/i, /source/i, /sink/i]) {
      expect(text).toMatch(name);
    }
  });

  it('shows each type with its default footprint, height and behavior', () => {
    render(<LibraryPanel unit="m" selectedId={null} onSelect={() => {}} />);
    for (const t of BASE_EQUIPMENT_TYPES) {
      const item = screen.getByRole('listitem', { name: t.name });
      const s = within(item);
      expect(
        s.getByText(new RegExp(`${t.footprint.width} × ${t.footprint.length} m`)),
      ).toBeTruthy();
      expect(s.getByText(new RegExp(`height ${t.height} m`))).toBeTruthy();
      expect(s.getByText(new RegExp(`behavior: ${t.behavior}`))).toBeTruthy();
    }
  });

  it('displays dimensions in ft without changing the stored meters', () => {
    render(<LibraryPanel unit="ft" selectedId={null} onSelect={() => {}} />);
    const item = screen.getByRole('listitem', { name: 'Workstation' });
    expect(within(item).getByText(/6\.56 × 4\.92 ft/)).toBeTruthy();
    expect(BASE_EQUIPMENT_TYPES[0]!.footprint.width).toBe(2);
  });

  it('selecting a type reports it for preview', async () => {
    const onSelect = vi.fn();
    render(<LibraryPanel unit="m" selectedId={null} onSelect={onSelect} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /conveyor/i }));
    expect(onSelect).toHaveBeenCalledWith('base-conveyor');
  });
});

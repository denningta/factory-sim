import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BASE_EQUIPMENT_TYPES } from '@factory-sim/schema';
import { EQUIPMENT_DRAG_TYPE, LibraryPanel } from './LibraryPanel';
import { TYPE_DESCRIPTIONS } from './descriptions';

afterEach(cleanup);

describe('LibraryPanel', () => {
  it('every behavior has a non-empty one-line description', () => {
    for (const t of BASE_EQUIPMENT_TYPES) {
      const d = TYPE_DESCRIPTIONS[t.behavior];
      expect(d.length).toBeGreaterThan(5);
      expect(d).not.toContain('\n');
    }
  });

  it('lists workstation, buffer/rack, conveyor, source, sink and autoclave', () => {
    render(<LibraryPanel unit="m" selectedId={null} onSelect={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(6);
    const text = items.map((i) => i.textContent ?? '').join('|');
    for (const name of [/workstation/i, /buffer/i, /conveyor/i, /source/i, /sink/i, /autoclave/i]) {
      expect(text).toMatch(name);
    }
  });

  it('shows each type with a one-line description of its behavior and its default footprint and height', () => {
    render(<LibraryPanel unit="m" selectedId={null} onSelect={() => {}} />);
    for (const t of BASE_EQUIPMENT_TYPES) {
      const item = screen.getByRole('listitem', { name: t.name });
      const s = within(item);
      expect(
        s.getByText(new RegExp(`${t.footprint.width} × ${t.footprint.length} m`)),
      ).toBeTruthy();
      expect(s.getByText(new RegExp(`height ${t.height} m`))).toBeTruthy();
      expect(s.getByText(TYPE_DESCRIPTIONS[t.behavior])).toBeTruthy();
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

  it('Dragging from the library carries the type id for the canvas to place', () => {
    render(<LibraryPanel unit="m" selectedId={null} onSelect={() => {}} />);
    const items = screen.getAllByRole('listitem');
    const data: Record<string, string> = {};
    const dataTransfer = { setData: (k: string, v: string) => (data[k] = v), effectAllowed: '' };
    const button = within(items[1]!).getByRole('button');
    expect(button.getAttribute('draggable')).toBe('true');
    fireEvent.dragStart(button, { dataTransfer });
    expect(data[EQUIPMENT_DRAG_TYPE]).toBe(BASE_EQUIPMENT_TYPES[1]!.id);
  });
});

describe('LibraryPanel with user types (EQ-3)', () => {
  const mine = {
    id: '11111111-1111-4111-8111-111111111111',
    name: '5-axis CNC',
    behavior: 'workstation' as const,
    params: { capacity: 1, batchSize: 1, labor: { mode: 'manual' as const } },
    footprint: { width: 3, length: 2.5 },
    height: 2.4,
    color: '#2f6f9f',
    ports: [],
  };

  it('AC2: my types are listed after the built-ins and can be dragged onto the canvas', () => {
    render(<LibraryPanel unit="m" selectedId={null} onSelect={() => {}} userTypes={[mine]} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(7);
    const button = within(items[6]!).getByRole('button', { name: /^5-axis CNC/ });
    const data: Record<string, string> = {};
    fireEvent.dragStart(button, {
      dataTransfer: { setData: (k: string, v: string) => (data[k] = v), effectAllowed: '' },
    });
    expect(data[EQUIPMENT_DRAG_TYPE]).toBe(mine.id);
  });

  it('AC3: only my types offer edit and delete', async () => {
    const onEdit = vi.fn();
    render(
      <LibraryPanel
        unit="m"
        selectedId={null}
        onSelect={() => {}}
        userTypes={[mine]}
        onEdit={onEdit}
        onDelete={() => {}}
      />,
    );
    expect(screen.getAllByRole('button', { name: /^edit/i })).toHaveLength(1);
    await userEvent.setup().click(screen.getByRole('button', { name: /^edit/i }));
    expect(onEdit).toHaveBeenCalledWith(mine);
  });
});

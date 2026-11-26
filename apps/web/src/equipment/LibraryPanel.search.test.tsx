import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BASE_EQUIPMENT_TYPES, type EquipmentType } from '@factory-sim/schema';
import { LibraryPanel } from './LibraryPanel';

afterEach(cleanup);
const mine: EquipmentType = { ...BASE_EQUIPMENT_TYPES[0]!, id: 'user-1', name: 'Paint booth' };
const ui = () =>
  render(<LibraryPanel unit="m" selectedId={null} onSelect={() => {}} userTypes={[mine]} />);

describe('UI-3 AC1: library search and groups', () => {
  it('groups types under "Base types" and "My equipment"', () => {
    ui();
    const base = screen.getByRole('region', { name: 'Base types' });
    const own = screen.getByRole('region', { name: 'My equipment' });
    expect(base.querySelectorAll('li')).toHaveLength(5);
    expect(own.textContent).toContain('Paint booth');
  });

  it('typing filters by name, clearing restores', async () => {
    ui();
    const user = userEvent.setup();
    const box = screen.getByRole('searchbox', { name: /search types/i });
    await user.type(box, 'conveyor');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    await user.clear(box);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('also matches the description', async () => {
    ui();
    await userEvent.setup().type(screen.getByRole('searchbox'), 'ships finished');
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toMatch(/sink/i);
  });

  it('shows a one-line next step when nothing matches', async () => {
    ui();
    await userEvent.setup().type(screen.getByRole('searchbox'), 'zzzz');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText(/no types match/i)).toBeTruthy();
  });
});

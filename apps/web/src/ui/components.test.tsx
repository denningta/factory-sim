import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge, Button, EmptyState, Field, Legend, Section, StatTile, Tabs } from './index';

afterEach(cleanup);

describe('UI-1 AC2: base components expose an accessible role and name', () => {
  it('Button: primary, secondary, danger and disabled are buttons with a name', async () => {
    const onClick = vi.fn();
    render(
      <>
        <Button variant="primary" onClick={onClick}>
          Save
        </Button>
        <Button>Cancel</Button>
        <Button variant="danger">Delete</Button>
        <Button disabled>Run</Button>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect((screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect((screen.getByRole('button', { name: 'Run' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Button defaults to type=button so it never submits a form by accident', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' }).getAttribute('type')).toBe('button');
  });

  it('Field: label names the input, the unit and error text are wired by id', () => {
    const { rerender } = render(<Field label="Width" unit="m" value="3" onChange={() => {}} />);
    const input = screen.getByRole('textbox', { name: 'Width' });
    expect((input as HTMLInputElement).value).toBe('3');
    expect(screen.getByText('m')).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBeNull();
    rerender(<Field label="Width" unit="m" value="x" error="Enter a number" onChange={() => {}} />);
    const bad = screen.getByRole('textbox', { name: 'Width' });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Enter a number');
    expect(bad.getAttribute('aria-invalid')).toBe('true');
    expect(bad.getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
    expect(alert.id).not.toBe('');
  });

  it('Field: forwards typing to onChange', async () => {
    const onChange = vi.fn();
    render(<Field label="Name" value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('Section: heading, optional description, optionally collapsible', async () => {
    const { rerender } = render(
      <Section heading="Floor" description="Size of the room">
        <p>body</p>
      </Section>,
    );
    expect(screen.getByRole('heading', { name: 'Floor' })).toBeTruthy();
    expect(screen.getByText('Size of the room')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
    rerender(
      <Section heading="Floor" collapsible>
        <p>body</p>
      </Section>,
    );
    const toggle = screen.getByRole('button', { name: 'Floor' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('body')).toBeNull();
  });

  it('Tabs: a tablist of tabs, the selected one flagged, onChange on click', async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        label="Screens"
        value="b"
        onChange={onChange}
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
      />,
    );
    const list = screen.getByRole('tablist', { name: 'Screens' });
    expect(within(list).getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('false');
    await userEvent.click(screen.getByRole('tab', { name: 'Alpha' }));
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('StatTile: a group named by its label with value, unit and sub-line', () => {
    render(<StatTile label="Throughput" value="42" unit="/h" sub="target 50" />);
    const tile = screen.getByRole('group', { name: 'Throughput' });
    expect(tile.textContent).toContain('42');
    expect(tile.textContent).toContain('/h');
    expect(tile.textContent).toContain('target 50');
  });

  it('Legend: a named list whose items are just the labels', () => {
    render(
      <Legend
        label="State legend"
        items={[
          { key: 'working', label: 'Working', color: '#1d9a55' },
          { key: 'idle', label: 'Idle', color: '#8a94a3' },
        ]}
      />,
    );
    const items = within(screen.getByRole('list', { name: 'State legend' })).getAllByRole(
      'listitem',
    );
    expect(items.map((i) => i.textContent)).toEqual(['Working', 'Idle']);
  });

  it('Badge: shows its text', () => {
    render(<Badge tone="danger">Blocked</Badge>);
    expect(screen.getByText('Blocked')).toBeTruthy();
  });

  it('EmptyState: a heading, a description and an optional action', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState title="No projects yet" action={<Button onClick={onClick}>Create one</Button>}>
        Create one above.
      </EmptyState>,
    );
    expect(screen.getByRole('heading', { name: 'No projects yet' })).toBeTruthy();
    expect(screen.getByText('Create one above.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Create one' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditorStore } from '../layout/editorStore';
import type { RunSession } from './runSession';
import { SimulateScreen } from './SimulateScreen';

vi.mock('../layout/FloorScene', () => ({
  FloorScene: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
// R3F hooks need a real Canvas.
vi.mock('./TechLayer', () => ({ TechLayer: () => <div /> }));
vi.mock('./StationLayer', () => ({ StationLayer: () => <div /> }));
// Stands in for the render loop that calls session.frame in the real PartLayer.
vi.mock('./PartLayer', () => ({
  PartLayer: ({ session }: { session: RunSession }) => {
    useEffect(() => {
      const id = setInterval(() => session.frame(1 / 60), 5);
      return () => clearInterval(id);
    }, [session]);
    return <div />;
  },
}));

beforeEach(() => {
  useEditorStore.setState(useEditorStore.getInitialState(), true);
  const s = useEditorStore.getState;
  const src = s().placeEquipment('base-source', { x: 0, y: 0 })!;
  const ws = s().placeEquipment('base-workstation', { x: 6, y: 0 })!;
  const sink = s().placeEquipment('base-sink', { x: 12, y: 0 })!;
  s().connect({ equipmentId: src.id, portId: 'out' }, { equipmentId: ws.id, portId: 'in' });
  s().connect({ equipmentId: ws.id, portId: 'out' }, { equipmentId: sink.id, portId: 'in' });
  const p = s().addProduct();
  s().addRoutingStep(p.id, ws.id);
  s().setCycleTime(p.id, ws.id, 5);
  s().setReleaseInterval(4);
  const t = s().addTechnician();
  s().setTechnicianStation(t.id, ws.id, true);
});
afterEach(cleanup);

const clock = () => screen.getByRole('timer').textContent ?? '';
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('SE-2: SimulateScreen playback controls', () => {
  it('Step moves the clock past 0:00:00 and the button still reads Play', async () => {
    render(<SimulateScreen />);
    expect(clock()).toMatch(/^Day 1, 00:00:00/);
    // Early events can share the same second, so take a few steps.
    for (let i = 0; i < 6; i++) await userEvent.click(button('Step'));
    await waitFor(() => expect(clock()).not.toMatch(/^Day 1, 00:00:00/));
    expect(button('Play')).toBeTruthy();
  });

  it('Run to end unchecks Animate, finishes, and disables Step and Run to end', async () => {
    render(<SimulateScreen />);
    await userEvent.click(button('Run to end'));
    await waitFor(() => expect(clock()).toContain('(finished)'), { timeout: 5000 });
    expect((screen.getByLabelText('Animate') as HTMLInputElement).checked).toBe(false);
    expect(button('Step').disabled).toBe(true);
    expect(button('Run to end').disabled).toBe(true);
  });

  it('Reset puts the clock back to Day 1, 00:00:00', async () => {
    render(<SimulateScreen />);
    await userEvent.click(button('Run to end'));
    await waitFor(() => expect(clock()).toContain('(finished)'), { timeout: 5000 });
    await userEvent.click(button('Reset'));
    await waitFor(() => expect(clock()).toBe('Day 1, 00:00:00'));
    expect(button('Step').disabled).toBe(false);
  });
});

describe('SE-4: run settings panel', () => {
  const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
  const set = async (name: string, value: string) => {
    await userEvent.clear(field(name));
    await userEvent.type(field(name), value);
  };

  it('run length in shifts and warm-up use the shift length: the run ends at warm-up + length', async () => {
    render(<SimulateScreen />);
    await set('Shift length (hr)', '1');
    await set('Warm-up (hr)', '1');
    await set('Run length', '2');
    await userEvent.click(button('Apply'));
    await userEvent.click(button('Run to end'));
    await waitFor(() => expect(clock()).toBe('Day 1, 03:00:00 (finished)'), { timeout: 5000 });
    expect(useEditorStore.getState().shiftLength).toBe(3600);
  });

  it('run length can be given in hours', async () => {
    render(<SimulateScreen />);
    await userEvent.selectOptions(screen.getByLabelText('Run length unit'), 'hours');
    await set('Run length', '2');
    await userEvent.click(button('Apply'));
    await userEvent.click(button('Run to end'));
    await waitFor(() => expect(clock()).toBe('Day 1, 02:00:00 (finished)'), { timeout: 5000 });
  });

  it('a random seed is drawn on Apply and shown; a fixed seed is kept', async () => {
    render(<SimulateScreen />);
    expect(field('Seed').value).toBe('1');
    await userEvent.selectOptions(screen.getByLabelText('Seed mode'), 'random');
    await userEvent.click(button('Apply'));
    const drawn = screen.getByRole('status', { name: 'Seed used' }).textContent ?? '';
    expect(drawn).toMatch(/\d+/);
    await userEvent.selectOptions(screen.getByLabelText('Seed mode'), 'fixed');
    await set('Seed', '42');
    await userEvent.click(button('Apply'));
    expect(screen.getByRole('status', { name: 'Seed used' }).textContent).toContain('42');
  });
});

describe('AN-2: utilization panel on the Simulate screen', () => {
  it('renders the station and technician utilization tables after a run', async () => {
    render(<SimulateScreen />);
    await userEvent.click(button('Run to end'));
    await waitFor(() => expect(clock()).toContain('(finished)'), { timeout: 5000 });
    const table = screen.getByRole('table', { name: 'Station utilization' });
    expect(within(table).getAllByRole('rowheader').length).toBeGreaterThan(0);
    expect(within(table).getAllByRole('cell')[0]!.textContent).toMatch(/^\d+\.\d%$/);
    expect(screen.getByRole('table', { name: 'Technician utilization' })).toBeTruthy();
  });
});

describe('AN-1: live KPI panel', () => {
  const panel = () => screen.getByRole('region', { name: 'Live KPIs' });

  it('shows throughput per hour and per shift, WIP and lead time per product and in total, warm-up excluded', () => {
    render(<SimulateScreen />);
    const text = panel().textContent ?? '';
    expect(text).toContain('Warm-up excluded');
    expect(text).toMatch(/Throughput/);
    expect(text).toMatch(/units\/hr/);
    expect(text).toMatch(/units\/shift/);
    expect(text).toMatch(/WIP/);
    expect(text).toMatch(/Lead time/);
    expect(screen.getByRole('row', { name: /Total/ })).toBeTruthy();
    const name = useEditorStore.getState().products[0]!.name;
    expect(screen.getByRole('row', { name: new RegExp(name) })).toBeTruthy();
  });

  const cells = (row: HTMLElement) =>
    within(row)
      .getAllByRole('cell')
      .map((c) => c.textContent);
  const total = () => screen.getByRole('row', { name: /Total/ });
  const playAt1000 = async () => {
    fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '1000' } });
    await userEvent.click(button('Play'));
  };

  it('updates while the run plays: the Total row changes before the run is finished', async () => {
    render(<SimulateScreen />);
    const before = total().textContent;
    await playAt1000();
    await waitFor(() => expect(total().textContent).not.toBe(before), { timeout: 5000 });
    expect(clock()).not.toContain('(finished)');
    await userEvent.click(button('Run to end'));
    await waitFor(() => expect(clock()).toContain('(finished)'), { timeout: 8000 });
    const final = total().textContent;
    expect(final).toMatch(/[1-9]/);
    await new Promise((r) => setTimeout(r, 400));
    expect(total().textContent).toBe(final);
  });

  it('excludes the warm-up: the whole row is zero during it, but not without a warm-up', async () => {
    const upTo = async (min: number) => {
      await playAt1000();
      await waitFor(() => expect(Number(clock().split(':')[1])).toBeGreaterThanOrEqual(min), {
        timeout: 5000,
      });
      await userEvent.click(button('Pause'));
    };
    const field = screen.getByLabelText.bind(screen);
    render(<SimulateScreen />);
    await userEvent.clear(field('Warm-up (hr)'));
    await userEvent.type(field('Warm-up (hr)'), '2');
    await userEvent.click(button('Apply'));
    await upTo(1);
    expect(cells(total())).toEqual(['0.0', '0', '0.0', '–']);
    cleanup();
    // The warm-up is saved with the project (SE-7), so clear it for the no-warm-up run.
    useEditorStore.setState({ run: { ...useEditorStore.getState().run, warmUp: 0 } });

    render(<SimulateScreen />);
    await upTo(1);
    const [perHour, , wip] = cells(total());
    expect(Number(perHour)).toBeGreaterThan(0);
    expect(Number(wip)).toBeGreaterThan(0);
  });
});

describe('SE-7: run settings panel', () => {
  it('AC1: shows the saved run settings from the project', () => {
    useEditorStore.getState().applyRun(
      {
        warmUp: 3600,
        length: { unit: 'seconds', value: 7200 },
        seed: { mode: 'fixed', value: 42 },
      },
      8 * 3600,
    );
    render(<SimulateScreen />);
    expect((screen.getByLabelText('Warm-up (hr)') as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText('Run length') as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText('Run length unit') as HTMLSelectElement).value).toBe('hours');
    expect((screen.getByLabelText('Seed') as HTMLInputElement).value).toBe('42');
    expect(screen.getByRole('status', { name: 'Seed used' }).textContent).toContain('42');
  });

  it('AC2/AC3: Apply saves to the project; a warm-up not shorter than the run is refused', async () => {
    render(<SimulateScreen />);
    await userEvent.clear(screen.getByLabelText('Warm-up (hr)'));
    await userEvent.type(screen.getByLabelText('Warm-up (hr)'), '8');
    await userEvent.click(button('Apply'));
    expect(screen.getByText(/shorter/)).toBeTruthy();
    expect(useEditorStore.getState().run.warmUp).toBe(0);
    await userEvent.clear(screen.getByLabelText('Warm-up (hr)'));
    await userEvent.type(screen.getByLabelText('Warm-up (hr)'), '2');
    await userEvent.click(button('Apply'));
    expect(useEditorStore.getState().run.warmUp).toBe(7200);
    useEditorStore.getState().undo();
    await waitFor(() =>
      expect((screen.getByLabelText('Warm-up (hr)') as HTMLInputElement).value).toBe('0'),
    );
  });

  it('AC4: after a random-mode run with saved value 77, picking Fixed shows 77', async () => {
    render(<SimulateScreen />);
    await userEvent.clear(screen.getByLabelText('Seed'));
    await userEvent.type(screen.getByLabelText('Seed'), '77');
    await userEvent.selectOptions(screen.getByLabelText('Seed mode'), 'random');
    await userEvent.click(button('Apply'));
    expect(useEditorStore.getState().run.seed).toEqual({ mode: 'random', value: 77 });
    expect(screen.getByRole('status', { name: 'Seed used' }).textContent).not.toContain('77');
    await userEvent.selectOptions(screen.getByLabelText('Seed mode'), 'fixed');
    expect((screen.getByLabelText('Seed') as HTMLInputElement).value).toBe('77');
  });

  it('refuses an invalid seed in random mode, so nothing invalid is saved', async () => {
    render(<SimulateScreen />);
    await userEvent.selectOptions(screen.getByLabelText('Seed mode'), 'random');
    await userEvent.clear(screen.getByLabelText('Seed'));
    await userEvent.type(screen.getByLabelText('Seed'), '1.5');
    await userEvent.click(button('Apply'));
    expect(screen.getByText(/Seed must be a whole number/)).toBeTruthy();
    expect(useEditorStore.getState().run.seed.value).toBe(1);
  });
});

describe('SE-8: playback toolbar matches the wireframe', () => {
  it('has separate Play and Pause buttons; Play is disabled while playing, Pause while paused', async () => {
    render(<SimulateScreen />);
    expect(button('Play').disabled).toBe(false);
    expect(button('Pause').disabled).toBe(true);
    await userEvent.click(button('Play'));
    expect(button('Play').disabled).toBe(true);
    expect(button('Pause').disabled).toBe(false);
    await userEvent.click(button('Pause'));
    expect(button('Play').disabled).toBe(false);
    expect(button('Pause').disabled).toBe(true);
  });

  it('speed is a slider from 1× to 1000×', () => {
    render(<SimulateScreen />);
    const slider = screen.getByLabelText('Speed') as HTMLInputElement;
    expect(slider.type).toBe('range');
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('1000');
    expect(slider.value).toBe('1');
    fireEvent.change(slider, { target: { value: '250' } });
    expect(slider.value).toBe('250');
    expect(screen.getByText('250×')).toBeTruthy();
  });

  it('the clock shows Day N, hh:mm:ss and rolls over to the next day after 23:59:59', async () => {
    render(<SimulateScreen />);
    await userEvent.selectOptions(screen.getByLabelText('Run length unit'), 'hours');
    await userEvent.clear(screen.getByLabelText('Run length'));
    await userEvent.type(screen.getByLabelText('Run length'), '30');
    await userEvent.click(button('Apply'));
    await userEvent.click(button('Run to end'));
    await waitFor(() => expect(clock()).toMatch(/^Day 2, 06:00:00 \(finished\)/), {
      timeout: 8000,
    });
  }, 10000);
});

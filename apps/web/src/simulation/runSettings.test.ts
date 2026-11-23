import { describe, expect, it } from 'vitest';
import { createProject } from '@factory-sim/schema';
import { createEditorStore } from '../layout/editorStore';
import { createRunSession } from './runSession';
import { DEFAULT_RUN_SETTINGS, toRunOptions, validateRunSettings } from './runSettings';

const settings = (o = {}) => ({ ...DEFAULT_RUN_SETTINGS, ...o });

describe('SE-4: run settings', () => {
  it('run length in hours is converted to seconds, warm-up hours too', () => {
    const { options } = toRunOptions(
      settings({ runLength: 2.5, runUnit: 'hours', warmUpHours: 1 }),
      28800,
    );
    expect(options.runLength).toBe(9000);
    expect(options.warmUp).toBe(3600);
  });

  it('run length in shifts uses the shift length (default 8 h)', () => {
    expect(toRunOptions(settings({ runLength: 2 }), 8 * 3600).options.runLength).toBe(16 * 3600);
    expect(toRunOptions(settings({ runLength: 2 }), 4 * 3600).options.runLength).toBe(8 * 3600);
    expect(createProject().calendar.shiftLength).toBe(8 * 3600);
  });

  it('a fixed seed is used as given; a random seed is drawn and reported', () => {
    expect(toRunOptions(settings({ seed: 42 }), 3600).seed).toBe(42);
    const r = toRunOptions(settings({ seedMode: 'random', seed: 42 }), 3600, () => 0.5);
    expect(r.seed).toBe(Math.floor(0.5 * 2 ** 31));
    expect(r.options.seed).toBe(r.seed);
  });

  it('rejects negative warm-up, non-positive run length and non-integer seeds', () => {
    expect(validateRunSettings(settings())).toBeNull();
    expect(validateRunSettings(settings({ warmUpHours: -1 }))).not.toBeNull();
    expect(validateRunSettings(settings({ runLength: 0 }))).not.toBeNull();
    expect(validateRunSettings(settings({ seed: 1.5 }))).not.toBeNull();
  });
});

function line() {
  const s = createEditorStore().getState();
  const src = s.placeEquipment('base-source', { x: 0, y: 0 })!;
  const ws = s.placeEquipment('base-workstation', { x: 6, y: 0 })!;
  const sink = s.placeEquipment('base-sink', { x: 12, y: 0 })!;
  s.connect({ equipmentId: src.id, portId: 'out' }, { equipmentId: ws.id, portId: 'in' });
  s.connect({ equipmentId: ws.id, portId: 'out' }, { equipmentId: sink.id, portId: 'in' });
  const p = s.addProduct();
  s.addRoutingStep(p.id, ws.id);
  s.setCycleTime(p.id, ws.id, 5);
  s.setReleaseInterval(4);
  const t = s.addTechnician();
  s.setTechnicianStation(t.id, ws.id, true);
  return { ...createProject(), ...pick(s) };
}
const pick = (s: ReturnType<ReturnType<typeof createEditorStore>['getState']>) => ({
  floor: s.floor,
  equipment: s.equipment,
  connections: s.connections,
  products: s.products,
  cycleTimes: s.cycleTimes,
  technicians: s.technicians,
  demand: s.demand,
  release: s.release,
});

function finish(seed: number, warmUpHours = 0) {
  const r = createRunSession(
    line(),
    toRunOptions(settings({ seed, warmUpHours, runLength: 1, runUnit: 'hours' }), 3600).options,
  );
  if (!r.ok) throw new Error('model invalid');
  r.session.setAnimate(false);
  r.session.runToEnd();
  while (!r.session.done) r.session.frame(3600);
  return r.session.stats();
}

describe('SE-4: determinism and warm-up through the run session', () => {
  it('the same seed and model give identical results', () => {
    expect(finish(7)).toEqual(finish(7));
  });

  it('warm-up is excluded: the statistics window starts at the warm-up time', () => {
    const w = finish(1, 1).window;
    expect(w.from).toBe(3600);
    expect(w.to).toBe(7200);
  });
});

import { describe, expect, it } from 'vitest';
import type { Connection, Equipment } from '@factory-sim/schema';
import { hideDragged, portWorldPosition } from './ports';

const e = { position: { x: 10, y: 5 }, rotation: 0, footprint: { width: 2, length: 4 } };

describe('portWorldPosition', () => {
  it('places an unrotated port at position + (u·width, v·length)', () => {
    expect(portWorldPosition(e, { u: 0, v: 0.5 })).toEqual({ x: 10, y: 7 });
    expect(portWorldPosition(e, { u: 0.5, v: -0.5 })).toEqual({ x: 11, y: 3 });
  });

  it('rotates the offset by the instance rotation (plan angle runs x→y)', () => {
    const p = portWorldPosition({ ...e, rotation: Math.PI / 2 }, { u: 0, v: 0.5 });
    expect(p.x).toBeCloseTo(8, 10);
    expect(p.y).toBeCloseTo(5, 10);
  });
});

describe('hideDragged', () => {
  const mk = (id: string) => ({ id }) as unknown as Equipment;
  const eq = [mk('a'), mk('b'), mk('c')];
  const conn = (id: string, from: string, to: string) =>
    ({
      id,
      from: { equipmentId: from, portId: 'out' },
      to: { equipmentId: to, portId: 'in' },
      capacity: 0,
    }) as Connection;
  const cs = [conn('1', 'a', 'b'), conn('2', 'b', 'c')];

  it('keeps everything when nothing is dragged', () => {
    expect(hideDragged(eq, cs, [])).toEqual({ equipment: eq, connections: cs });
  });

  it('drops ports and arrows that touch a dragged item', () => {
    const r = hideDragged(eq, cs, ['a']);
    expect(r.equipment.map((e) => e.id)).toEqual(['b', 'c']);
    expect(r.connections.map((c) => c.id)).toEqual(['2']);
  });
});

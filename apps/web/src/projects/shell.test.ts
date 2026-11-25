import { describe, expect, it } from 'vitest';
import {
  BASE_EQUIPMENT_TYPES,
  instantiate,
  type Equipment,
  type Project,
} from '@factory-sim/schema';
import { formatHash, parseHash, screenBadges } from './shell';

const ws = BASE_EQUIPMENT_TYPES.find((t) => t.id === 'base-workstation')!;
const station = (id: string, x: number): Equipment => ({
  ...instantiate(ws, { id, name: id, position: { x, y: 0 } }),
  footprint: { width: 2, length: 1 },
});
const product = (stationIds: string[]): Project['products'][number] => ({
  id: 'p',
  partNumber: 'P',
  name: 'P',
  color: '#000000',
  routing: stationIds.map((stationId, i) => ({ id: `s${i}`, stationId })),
});

describe('UI-2 AC4: the open tab is part of the URL', () => {
  it('#/p/<id> opens Layout and #/p/<id>/<tab> opens that tab', () => {
    expect(parseHash('#/p/abc')).toEqual({ id: 'abc', screen: 'layout' });
    expect(parseHash('#/p/abc/results')).toEqual({ id: 'abc', screen: 'results' });
    expect(parseHash('#/p/abc/products')).toEqual({ id: 'abc', screen: 'products' });
    expect(parseHash('#/p/abc/nope')).toEqual({ id: 'abc', screen: 'layout' });
    expect(parseHash('')).toBeNull();
  });
  it('formats a hash that parses back', () => {
    expect(parseHash(formatHash('abc', 'simulate'))).toEqual({ id: 'abc', screen: 'simulate' });
  });
});

describe('UI-2 AC3: badge counts', () => {
  const base = { cycleTimes: [], technicians: [] };
  it('Layout counts overlaps plus routed manual stations without a tech', () => {
    const equipment = [station('a', 0), station('b', 1), station('c', 10)];
    // a/b overlap (1); only a and c are routed, both manual with no tech (2).
    const r = screenBadges({ ...base, equipment, products: [product(['a', 'c'])] });
    expect(r.layout).toBe(3);
  });
  it('does not count an unrouted manual station', () => {
    expect(screenBadges({ ...base, equipment: [station('a', 0)], products: [] }).layout).toBe(0);
  });
  it('Products counts missing cycle times, or 1 when there are no products', () => {
    const equipment = [station('a', 0), station('c', 10)];
    expect(screenBadges({ ...base, equipment, products: [product(['a', 'c'])] }).products).toBe(2);
    expect(screenBadges({ ...base, equipment, products: [] }).products).toBe(1);
  });
});

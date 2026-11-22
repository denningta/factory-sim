import { describe, expect, it } from 'vitest';
import { formatLength, fromDisplay, METERS_PER_FOOT, toDisplay } from './units';

describe('units (LE-1: switching units changes display only)', () => {
  it('uses the exact international foot', () => {
    expect(METERS_PER_FOOT).toBe(0.3048);
    expect(fromDisplay(100, 'ft')).toBeCloseTo(30.48, 10);
    expect(fromDisplay(5, 'm')).toBe(5);
  });
  it('round-trips ft -> m -> ft for typical values', () => {
    for (const ft of [1, 4, 80, 120, 12.5])
      expect(Number(toDisplay(fromDisplay(ft, 'ft'), 'ft').toFixed(6))).toBe(ft);
  });
  it('formats labels with trimmed decimals and a unit suffix', () => {
    expect(formatLength(30.48, 'ft')).toBe('100 ft');
    expect(formatLength(30, 'm')).toBe('30 m');
    expect(formatLength(1.23456, 'm')).toBe('1.23 m');
  });
});

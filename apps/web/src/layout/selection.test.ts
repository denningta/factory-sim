import { describe, expect, it } from 'vitest';
import { BASE_EQUIPMENT_TYPES, instantiate } from '@factory-sim/schema';
import { idsInRect } from './selection';

const at = (id: string, x: number, y: number) =>
  instantiate(BASE_EQUIPMENT_TYPES[0]!, { id, position: { x, y } });

describe('Multi-select with box select', () => {
  const items = [at('a', 1, 1), at('b', 5, 5), at('c', 9, 2)];

  it('selects the items whose centers are inside the box', () => {
    expect(idsInRect(items, { x: 0, y: 0 }, { x: 6, y: 6 })).toEqual(['a', 'b']);
  });

  it('works whichever corner the drag started from', () => {
    expect(idsInRect(items, { x: 10, y: 3 }, { x: 8, y: 0 })).toEqual(['c']);
  });

  it('an empty box selects nothing', () => {
    expect(idsInRect(items, { x: 20, y: 20 }, { x: 30, y: 30 })).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { BASE_EQUIPMENT_TYPES, instantiate, type Product, type Project } from '@factory-sim/schema';
import { missingCycleTimes, parseCycleTimeTable, parseDuration } from './cycleTimes';

const type = BASE_EQUIPMENT_TYPES.find((t) => t.id === 'base-workstation')!;
const station = (id: string, name: string) =>
  instantiate(type, { id, name, position: { x: 1, y: 1 } });
const saw = station('eq-1', 'Saw');
const cnc = station('eq-2', 'CNC');
const product = (id: string, partNumber: string, stations: string[]): Product => ({
  id,
  partNumber,
  name: `Name ${partNumber}`,
  color: '#2563eb',
  routing: stations.map((stationId, i) => ({ id: `${id}-s${i}`, stationId })),
});
const a = product('prod-1', 'A-100', ['eq-1', 'eq-2']);
const b = product('prod-2', 'B-200', ['eq-1']);
const project: Pick<Project, 'products' | 'equipment'> = {
  products: [a, b],
  equipment: [saw, cnc],
};

describe('PR-3 each cell takes a fixed time: duration input', () => {
  it.each([
    ['45', 45],
    ['1.5', 1.5],
    [' 12 ', 12],
    ['1:30', 90],
    ['0:45', 45],
    ['1:02:03', 3723],
  ])('reads %j as %d seconds', (text, seconds) => {
    expect(parseDuration(text)).toBe(seconds);
  });

  it.each(['', ' ', 'abc', '0', '-5', '1:75', '1:5', '1:', '2:3x', ':30', '1:2:3:4', '1e3'])(
    'rejects %j',
    (text) => {
      expect(parseDuration(text)).toBeNull();
    },
  );
});

describe('PR-3 missing cycle times are flagged before a run', () => {
  it('lists every (product, station) in a routing without a cycle time, once per station', () => {
    const twice = product('prod-3', 'C-300', ['eq-1', 'eq-1']);
    const cycleTimes: Project['cycleTimes'] = [
      { productId: 'prod-1', stationId: 'eq-1', time: { kind: 'fixed', value: 30 } },
    ];
    expect(missingCycleTimes({ products: [a, b, twice], cycleTimes })).toEqual([
      { productId: 'prod-1', stationId: 'eq-2' },
      { productId: 'prod-2', stationId: 'eq-1' },
      { productId: 'prod-3', stationId: 'eq-1' },
    ]);
  });

  it('is empty when every used cell is filled', () => {
    const cycleTimes: Project['cycleTimes'] = [
      ['prod-1', 'eq-1'],
      ['prod-1', 'eq-2'],
      ['prod-2', 'eq-1'],
    ].map(([productId, stationId]) => ({
      productId: productId!,
      stationId: stationId!,
      time: { kind: 'fixed', value: 10 },
    }));
    expect(missingCycleTimes({ products: [a, b], cycleTimes })).toEqual([]);
  });
});

describe('PR-3 import from CSV / paste from Excel', () => {
  it('reads a tab-separated Excel paste, matching products by part number and stations by name', () => {
    const text = ['Part\tSaw\tCNC', 'A-100\t30\t1:30', 'B-200\t45\t'].join('\n');
    expect(parseCycleTimeTable(text, project)).toEqual({
      entries: [
        { productId: 'prod-1', stationId: 'eq-1', seconds: 30 },
        { productId: 'prod-1', stationId: 'eq-2', seconds: 90 },
        { productId: 'prod-2', stationId: 'eq-1', seconds: 45 },
      ],
      errors: [],
    });
  });

  it('reads comma-separated CSV with quoted cells and CRLF line endings', () => {
    const text = 'part,"Saw",CNC\r\n"A-100",12.5,20\r\n';
    expect(parseCycleTimeTable(text, project).entries).toEqual([
      { productId: 'prod-1', stationId: 'eq-1', seconds: 12.5 },
      { productId: 'prod-1', stationId: 'eq-2', seconds: 20 },
    ]);
  });

  it('skips and reports unknown products, unknown stations, bad times and unused stations', () => {
    const text = [
      'Part\tSaw\tCNC\tPress',
      'A-100\t30\tx\t5',
      'B-200\t45\t7\t',
      'Z-999\t1\t1\t1',
    ].join('\n');
    const { entries, errors } = parseCycleTimeTable(text, project);
    expect(entries).toEqual([
      { productId: 'prod-1', stationId: 'eq-1', seconds: 30 },
      { productId: 'prod-2', stationId: 'eq-1', seconds: 45 },
    ]);
    expect(errors.join('\n')).toMatch(/Press/); // unknown station column
    expect(errors.join('\n')).toMatch(/Z-999/); // unknown product
    expect(errors.join('\n')).toMatch(/"x"/); // bad time
    expect(errors.join('\n')).toMatch(/B-200.*CNC|CNC.*B-200/); // B-200 doesn't route through CNC
  });

  it('reports an empty paste', () => {
    expect(parseCycleTimeTable('  \n', project).errors).toHaveLength(1);
  });
});

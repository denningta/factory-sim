import { describe, expect, it } from 'vitest';
import type { Project } from '@factory-sim/schema';
import { issueTarget } from './issueTarget';

const project = {
  equipment: [{ id: 'S1' }],
  products: [{ id: 'A', routing: [{ id: 'step-1', stationId: 'S1' }] }],
} as unknown as Project;
const issue = (objectId?: string) => ({
  code: 'x',
  message: 'm',
  severity: 'error' as const,
  objectId,
});

describe('SE-5 AC2: an issue maps to the object to select', () => {
  it('equipment ids map to the layout screen', () => {
    expect(issueTarget(project, issue('S1'))).toEqual({ screen: 'layout', equipmentId: 'S1' });
  });
  it('routing step ids map to their station', () => {
    expect(issueTarget(project, issue('step-1'))).toEqual({ screen: 'layout', equipmentId: 'S1' });
  });
  it('product ids map to the products screen', () => {
    expect(issueTarget(project, issue('A'))).toEqual({ screen: 'products', productId: 'A' });
  });
  it('missing cycle time issues map to the products screen with the step product', () => {
    const i = { ...issue('step-1'), code: 'missing_cycle_time' };
    expect(issueTarget(project, i)).toEqual({ screen: 'products', productId: 'A' });
  });
  it('issues with no object or an unknown one map to nothing', () => {
    expect(issueTarget(project, issue())).toBeUndefined();
    expect(issueTarget(project, issue('nope'))).toBeUndefined();
  });
});

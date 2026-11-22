import type { Project } from '@factory-sim/schema';

export interface PreRunIssue {
  code: 'no_products';
  message: string;
}

export function preRunIssues(_project: Pick<Project, 'products'>): PreRunIssue[] {
  throw new Error('not implemented');
}

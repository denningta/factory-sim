import type { ModelDefinition } from './types';

export const bench: ModelDefinition = {
  id: 'bench',
  label: 'Workbench',
  behaviors: ['workstation'],
  lodDistances: [60],
  build() {
    throw new Error('not implemented');
  },
};

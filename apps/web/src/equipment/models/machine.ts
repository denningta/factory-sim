import type { ModelDefinition } from './types';

export const machine: ModelDefinition = {
  id: 'machine',
  label: 'Workmachine',
  behaviors: ['workstation'],
  lodDistances: [60],
  build() {
    throw new Error('not implemented');
  },
};

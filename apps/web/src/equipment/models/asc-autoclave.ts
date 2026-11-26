import type { ModelDefinition } from './types';

/** Stub: the real model lands with the implementation commit. */
export const ascAutoclave: ModelDefinition = {
  id: 'asc-autoclave',
  label: 'Autoclave (ASC)',
  behaviors: ['workstation'],
  lodDistances: [60],
  build() {
    throw new Error('not implemented');
  },
};

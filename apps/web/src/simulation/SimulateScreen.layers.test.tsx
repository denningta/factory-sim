/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import src from './SimulateScreen.tsx?raw';

// The Running view mounts a WebGL canvas, which jsdom can't draw; check the wiring in source.
describe('SF-3 AC4: Simulate has the Layers menu and the shared arcs', () => {
  it('renders LayersMenu and ConnectionArcs, not the old RunConnections', () => {
    expect(src).toContain('<LayersMenu');
    expect(src).toContain('<ConnectionArcs');
    expect(src).not.toContain('RunConnections');
  });
});

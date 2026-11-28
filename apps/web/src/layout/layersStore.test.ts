import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLayersStore, LAYERS_KEY } from './layersStore';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('SF-3 AC4: layers are remembered per viewer', () => {
  it('Connections is on by default', () => {
    expect(createLayersStore().getState().connections).toBe(true);
  });

  it('a toggled layer is stored in browser storage and restored by a new store', () => {
    createLayersStore().getState().setConnections(false);
    expect(localStorage.getItem(LAYERS_KEY)).toContain('false');
    expect(createLayersStore().getState().connections).toBe(false);
  });

  it('works when storage throws on read and write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const s = createLayersStore();
    expect(s.getState().connections).toBe(true);
    s.getState().setConnections(false);
    expect(s.getState().connections).toBe(false);
  });

  it('ignores garbage in storage', () => {
    localStorage.setItem(LAYERS_KEY, '{nope');
    expect(createLayersStore().getState().connections).toBe(true);
  });
});

describe('UI-12 AC3: Shadows layer', () => {
  it('is on by default', () => {
    expect(createLayersStore().getState().shadows).toBe(true);
  });
  it('is remembered per viewer and does not disturb Connections', () => {
    const a = createLayersStore();
    a.getState().setShadows(false);
    const b = createLayersStore();
    expect(b.getState().shadows).toBe(false);
    expect(b.getState().connections).toBe(true);
    b.getState().setConnections(false);
    expect(createLayersStore().getState().shadows).toBe(false);
    expect(createLayersStore().getState().connections).toBe(false);
  });
  it('still reads a value stored before Shadows existed', () => {
    localStorage.setItem(LAYERS_KEY, JSON.stringify({ connections: false }));
    const s = createLayersStore().getState();
    expect(s.connections).toBe(false);
    expect(s.shadows).toBe(true);
  });
});

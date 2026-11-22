import { describe, expect, it } from 'vitest';
import { controlSettings } from './viewControls';

describe('Mouse orbit, pan and zoom in 3D', () => {
  it('3D allows rotating; right button rotates and middle pans (wheel zooms by default)', () => {
    const c = controlSettings('3d');
    expect(c.enableRotate).toBe(true);
    expect(c.mouseButtons.RIGHT).toBe(0); // THREE.MOUSE.ROTATE
    expect(c.mouseButtons.MIDDLE).toBe(2); // THREE.MOUSE.PAN
  });
});

describe('One click toggles an orthographic top-down view', () => {
  it('2D disables rotation so the view stays top-down, and the right button pans', () => {
    const c = controlSettings('2d');
    expect(c.enableRotate).toBe(false);
    expect(c.mouseButtons.RIGHT).toBe(2);
  });
});

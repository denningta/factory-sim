import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { controlSettings } from './viewControls';

describe('Mouse orbit, pan and zoom in 3D', () => {
  it('3D allows rotating; right button rotates and middle pans (wheel zooms by default)', () => {
    const c = controlSettings('3d');
    expect(c.enableRotate).toBe(true);
    expect(c.mouseButtons.RIGHT).toBe(THREE.MOUSE.ROTATE);
    expect(c.mouseButtons.MIDDLE).toBe(THREE.MOUSE.PAN);
  });
});

describe('One click toggles an orthographic top-down view', () => {
  it('2D disables rotation so the view stays top-down, and the right button pans', () => {
    const c = controlSettings('2d');
    expect(c.enableRotate).toBe(false);
    expect(c.mouseButtons.RIGHT).toBe(THREE.MOUSE.PAN);
  });
});

describe('Orbit limits keep the camera in a useful range', () => {
  for (const mode of ['3d', '2d'] as const)
    it(`${mode}: polar angle stays just above the floor; distance and zoom are bounded`, () => {
      const c = controlSettings(mode);
      if (mode === '3d') {
        expect(c.maxPolarAngle).toBeLessThan(Math.PI / 2);
        expect(c.maxPolarAngle).toBeGreaterThan(Math.PI / 2 - 0.2);
      }
      expect(c.minDistance).toBeGreaterThan(0);
      expect(c.maxDistance).toBeGreaterThan(c.minDistance);
      expect(c.maxDistance).toBeLessThan(5000); // camera far plane
      expect(c.minZoom).toBeGreaterThan(0);
      expect(c.maxZoom).toBeGreaterThan(c.minZoom);
    });
});

describe('The 2D view stays exactly top-down under OrbitControls', () => {
  it('2D leaves the polar angle unclamped (up = -z puts straight-down at polar π/2)', () => {
    expect(controlSettings('2d').maxPolarAngle).toBe(Math.PI);
  });

  it('the camera direction is exactly (0, -1, 0) after controls.update()', () => {
    const cam = new THREE.OrthographicCamera(-400, 400, 300, -300, 0.1, 5000);
    cam.up.set(0, 0, -1);
    cam.position.set(15, 100, 10);
    const controls = new OrbitControls(cam, document.createElement('div'));
    Object.assign(controls, controlSettings('2d'));
    controls.target.set(15, 0, 10);
    controls.update();
    cam.updateMatrixWorld();
    const d = cam.getWorldDirection(new THREE.Vector3());
    expect(d.x).toBeCloseTo(0, 9);
    expect(d.y).toBeCloseTo(-1, 9);
    expect(d.z).toBeCloseTo(0, 9);
    controls.dispose();
  });
});

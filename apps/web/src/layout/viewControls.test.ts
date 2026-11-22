import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { controlSettings } from './viewControls';

const FIT = { distance: 50, zoom: 20 };

describe('Mouse orbit, pan and zoom in 3D', () => {
  it('3D allows rotating; right button rotates and middle pans (wheel zooms by default)', () => {
    const c = controlSettings('3d', FIT);
    expect(c.enableRotate).toBe(true);
    expect(c.mouseButtons.RIGHT).toBe(THREE.MOUSE.ROTATE);
    expect(c.mouseButtons.MIDDLE).toBe(THREE.MOUSE.PAN);
  });
});

describe('One click toggles an orthographic top-down view', () => {
  it('2D disables rotation so the view stays top-down, and the right button pans', () => {
    const c = controlSettings('2d', FIT);
    expect(c.enableRotate).toBe(false);
    expect(c.mouseButtons.RIGHT).toBe(THREE.MOUSE.PAN);
  });
});

describe('Orbit limits keep the camera in a useful range', () => {
  for (const mode of ['3d', '2d'] as const)
    it(`${mode}: distance and zoom limits are derived from the fitted pose (0.05x to 4x)`, () => {
      const c = controlSettings(mode, FIT);
      expect(c.minDistance).toBeCloseTo(FIT.distance * 0.05);
      expect(c.maxDistance).toBeCloseTo(FIT.distance * 4);
      expect(c.minZoom).toBeCloseTo(FIT.zoom / 4);
      expect(c.maxZoom).toBeCloseTo(FIT.zoom / 0.05);
    });

  it('a very large floor still fits: its fitted distance is inside the limits', () => {
    const big = { distance: 3000, zoom: 0.2 };
    const c = controlSettings('3d', big);
    expect(big.distance).toBeGreaterThan(c.minDistance);
    expect(big.distance).toBeLessThan(c.maxDistance);
    expect(big.zoom).toBeGreaterThan(c.minZoom);
    expect(big.zoom).toBeLessThan(c.maxZoom);
  });

  it('3D: polar angle stays just above the floor', () => {
    const c = controlSettings('3d', FIT);
    expect(c.maxPolarAngle).toBeLessThan(Math.PI / 2);
    expect(c.maxPolarAngle).toBeGreaterThan(Math.PI / 2 - 0.2);
  });
});

describe('The 2D view stays exactly top-down under OrbitControls', () => {
  it('2D leaves the polar angle unclamped (up = -z puts straight-down at polar π/2)', () => {
    expect(controlSettings('2d', FIT).maxPolarAngle).toBe(Math.PI);
  });

  it('the camera direction is exactly (0, -1, 0) after controls.update()', () => {
    const cam = new THREE.OrthographicCamera(-400, 400, 300, -300, 0.1, 5000);
    cam.up.set(0, 0, -1);
    cam.position.set(15, 100, 10);
    const controls = new OrbitControls(cam, document.createElement('div'));
    Object.assign(controls, controlSettings('2d', FIT));
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

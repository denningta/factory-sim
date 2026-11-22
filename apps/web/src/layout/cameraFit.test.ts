import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { aspectOf, fitCamera, fitOrtho, labelLayout, planBounds } from './cameraFit';

const FOV = 45;

/** Projects a plan point (x, z at height y) through the fitted camera into NDC. */
function ndc(
  fit: ReturnType<typeof fitCamera>,
  aspect: number,
  [x, y, z]: [number, number, number],
) {
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 5000);
  cam.position.set(...fit.position);
  cam.lookAt(...fit.target);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return new THREE.Vector3(x, y, z).project(cam);
}

describe('fitCamera: the floor and its labels fit the canvas aspect', () => {
  const floors = [
    { width: 30, length: 20 },
    { width: 98.43 * 0.3048, length: 65.62 * 0.3048 },
    { width: 10, length: 80 },
    { width: 200, length: 5 },
  ];
  for (const aspect of [0.5, 1, 16 / 9, 3]) {
    for (const floor of floors) {
      it(`${floor.width} × ${floor.length} m at aspect ${aspect.toFixed(2)} stays inside the view`, () => {
        const fit = fitCamera({ ...floor, aspect, fovDeg: FOV });
        const b = planBounds(floor);
        for (const x of [b.minX, b.maxX])
          for (const z of [b.minZ, b.maxZ]) {
            const p = ndc(fit, aspect, [x, 0, z]);
            expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
          }
      });
    }
  }

  it('a narrow canvas needs a longer distance than a wide one for the same floor', () => {
    const floor = { width: 30, length: 20 };
    const dist = (aspect: number) => {
      const f = fitCamera({ ...floor, aspect, fovDeg: FOV });
      return Math.hypot(
        f.position[0] - f.target[0],
        f.position[1] - f.target[1],
        f.position[2] - f.target[2],
      );
    };
    expect(dist(0.6)).toBeGreaterThan(dist(2.5));
  });

  it('is tight: the limiting dimension nearly fills the canvas', () => {
    const floor = { width: 30, length: 20 };
    const fit = fitCamera({ ...floor, aspect: 1.5, fovDeg: FOV });
    const b = planBounds(floor);
    const extent = [b.minX, b.maxX].flatMap((x) =>
      [b.minZ, b.maxZ].map((z) => {
        const p = ndc(fit, 1.5, [x, 0, z]);
        return Math.max(Math.abs(p.x), Math.abs(p.y));
      }),
    );
    // Whichever dimension limits the fit should nearly fill the canvas (PAD leaves ~5%).
    expect(Math.max(...extent)).toBeGreaterThan(0.9);
  });

  it('the length label lies inside the plan bounds', () => {
    const floor = { width: 30, length: 20 };
    const { lengthLabel, textHeight } = labelLayout(floor);
    expect(lengthLabel[0] - 2 * textHeight).toBeGreaterThanOrEqual(planBounds(floor).minX);
  });
});

describe('aspectOf: the camera is never fitted to an unusable canvas size', () => {
  it('is null for a 0×0 canvas (before the shell has laid out) and for NaN or negative sizes', () => {
    for (const size of [
      { width: 0, height: 0 },
      { width: 800, height: 0 },
      { width: 0, height: 600 },
      { width: NaN, height: 600 },
      { width: 800, height: -1 },
    ])
      expect(aspectOf(size)).toBeNull();
  });

  it('is width / height once the canvas has a size, and fitCamera then stays finite', () => {
    const aspect = aspectOf({ width: 800, height: 400 });
    expect(aspect).toBe(2);
    const fit = fitCamera({ width: 30, length: 20, aspect: aspect!, fovDeg: FOV });
    expect([...fit.position, ...fit.target, fit.distance].every(Number.isFinite)).toBe(true);
  });
});

describe('Zoom-to-fit frames the whole floor (top-down 2D)', () => {
  const floors = [
    { width: 30, length: 20 },
    { width: 10, length: 80 },
    { width: 200, length: 5 },
  ];
  const viewports = [
    { width: 800, height: 600 },
    { width: 300, height: 900 },
    { width: 1600, height: 400 },
  ];
  for (const floor of floors)
    for (const viewport of viewports) {
      it(`${floor.width} × ${floor.length} m in ${viewport.width}×${viewport.height}px keeps floor and labels in view, tightly`, () => {
        const fit = fitOrtho({ ...floor, viewport });
        const aspect = viewport.width / viewport.height;
        const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
        // Same frustum sizing three/fiber gives an ortho camera: 1 world unit = `zoom` px.
        cam.left = -viewport.width / 2;
        cam.right = viewport.width / 2;
        cam.top = viewport.height / 2;
        cam.bottom = -viewport.height / 2;
        cam.zoom = fit.zoom;
        cam.up.set(0, 0, -1);
        cam.position.set(...fit.position);
        cam.lookAt(...fit.target);
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();
        expect(aspect).toBeGreaterThan(0);
        const b = planBounds(floor);
        let max = 0;
        for (const x of [b.minX, b.maxX])
          for (const z of [b.minZ, b.maxZ]) {
            const p = new THREE.Vector3(x, 0, z).project(cam);
            max = Math.max(max, Math.abs(p.x), Math.abs(p.y));
          }
        expect(max).toBeLessThanOrEqual(1);
        expect(max).toBeGreaterThan(0.9);
      });
    }

  it('looks straight down', () => {
    const fit = fitOrtho({ width: 30, length: 20, viewport: { width: 800, height: 600 } });
    expect(fit.position[0]).toBeCloseTo(fit.target[0]);
    expect(fit.position[2]).toBeCloseTo(fit.target[2]);
    expect(fit.position[1]).toBeGreaterThan(0);
  });
});

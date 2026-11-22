import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { pointerToFloor } from './picking';

function topDown(x: number, z: number, height = 10) {
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  cam.up.set(0, 0, -1); // looking straight down: the default up vector would be degenerate
  cam.position.set(x, height, z);
  cam.lookAt(x, 0, z);
  cam.updateMatrixWorld();
  return cam;
}

describe('Dragging from the library places an object at the cursor', () => {
  it('the pointer at screen centre hits the floor point under the camera', () => {
    const p = pointerToFloor(topDown(7, 4), { x: 0, y: 0 });
    expect(p!.x).toBeCloseTo(7, 6);
    expect(p!.y).toBeCloseTo(4, 6);
  });

  it('off-centre pointers map to the matching floor point (plan y is three z)', () => {
    // fov 45°, height 10: the top edge of the screen (ndc y = 1) is 10·tan(22.5°) ahead of centre.
    const p = pointerToFloor(topDown(0, 0), { x: 0, y: 1 });
    expect(Math.abs(p!.y)).toBeCloseTo(10 * Math.tan((22.5 * Math.PI) / 180), 6);
  });

  it('a ray that never reaches the floor yields null', () => {
    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cam.position.set(0, 5, 0);
    cam.lookAt(0, 10, 0); // looking up
    cam.updateMatrixWorld();
    expect(pointerToFloor(cam, { x: 0, y: 0 })).toBeNull();
  });
});

describe('Placing, moving and selecting work in the orthographic top-down view', () => {
  function ortho(x: number, z: number, zoom: number) {
    const cam = new THREE.OrthographicCamera(-400, 400, 300, -300, 0.1, 1000);
    cam.zoom = zoom;
    cam.up.set(0, 0, -1);
    cam.position.set(x, 50, z);
    cam.lookAt(x, 0, z);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    return cam;
  }

  it('screen centre maps to the floor point under the camera', () => {
    const p = pointerToFloor(ortho(12, 7, 10), { x: 0, y: 0 });
    expect(p!.x).toBeCloseTo(12, 6);
    expect(p!.y).toBeCloseTo(7, 6);
  });

  it('off-centre pointers scale with zoom: right edge is 400/zoom m right, top edge is 300/zoom m toward plan y−', () => {
    const p = pointerToFloor(ortho(12, 7, 10), { x: 1, y: 1 });
    expect(p!.x).toBeCloseTo(12 + 40, 6);
    expect(p!.y).toBeCloseTo(7 - 30, 6);
  });
});

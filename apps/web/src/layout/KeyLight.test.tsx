import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import * as THREE from 'three';
import { createRoot, extend } from '@react-three/fiber';
import { KeyLight } from './FloorScene';
import { useEditorStore } from './editorStore';
import { useLayersStore } from './layersStore';
import { KEY_DIRECTION, shadowFit } from './lighting';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
extend(THREE as never);

// jsdom has no WebGL, so R3F gets a stub renderer: the scene graph is real, nothing is drawn.
function stubRenderer() {
  return {
    domElement: document.createElement('canvas'),
    render() {},
    setSize() {},
    setPixelRatio() {},
    setClearColor() {},
    getSize: (v: THREE.Vector2) => v.set(100, 100),
    dispose() {},
    shadowMap: { enabled: false, type: 0 },
    xr: { enabled: false, addEventListener() {}, removeEventListener() {} },
    info: {},
    outputColorSpace: 'srgb',
    toneMapping: 0,
  };
}

const unmounts: (() => void)[] = [];
afterEach(() => {
  act(() => unmounts.splice(0).forEach((u) => u()));
  useLayersStore.setState({ shadows: true });
});

/** Mounts KeyLight in a real R3F scene graph and returns a getter for the live light. */
async function mountLight() {
  const root = createRoot(document.createElement('canvas'));
  await act(async () => {
    await root.configure({ gl: stubRenderer() as never, frameloop: 'never' });
  });
  const store = await act(async () => root.render(<KeyLight />));
  unmounts.push(() => root.unmount());
  const scene = store.getState().scene;
  return {
    scene,
    light: () =>
      scene.children.find(
        (c) => (c as THREE.DirectionalLight).isDirectionalLight,
      ) as THREE.DirectionalLight,
  };
}

describe('UI-12 AC2: the key light aims at the floor centre', () => {
  it('has its target in the scene, so the world direction points at the floor centre', async () => {
    useEditorStore.setState({ floor: { width: 30, length: 20, gridSpacing: 1 } });
    const { scene, light } = await mountLight();
    scene.updateMatrixWorld(true);
    const l = light();
    expect(l).toBeDefined();
    const target = new THREE.Vector3().setFromMatrixPosition(l.target.matrixWorld);
    expect(target.toArray()).toEqual(shadowFit({ width: 30, length: 20 }).target);
    const toLight = new THREE.Vector3()
      .setFromMatrixPosition(l.matrixWorld)
      .sub(target)
      .normalize();
    expect(toLight.distanceTo(new THREE.Vector3(...KEY_DIRECTION).normalize())).toBeLessThan(1e-6);
  });

  it('casts shadows only while the Shadows layer is on', async () => {
    const { light } = await mountLight();
    expect(light().castShadow).toBe(true);
    await act(async () => useLayersStore.getState().setShadows(false));
    expect(light().castShadow).toBe(false);
  });
});

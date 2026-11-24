// three.js scene: floor, lights, camera, orbit controls, CSS2D labels.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  camera.position.set(4, 14, 16);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(4, 0, 2);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 3;
  controls.maxDistance = 80;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(12, 22, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 80 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // 40 m × 30 m floor with a 1 m grid.
  const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(5, 0, 3);
  floor.receiveShadow = true;
  floor.name = 'floor';
  scene.add(floor);
  let grid;

  function applyTheme() {
    scene.background = new THREE.Color(css('--scene'));
    floorMat.color.set(css('--floor'));
    if (grid) scene.remove(grid);
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    grid = new THREE.GridHelper(60, 60, dark ? 0x3a424d : 0xaab1bb, dark ? 0x323943 : 0xb9c0c9);
    grid.position.set(5, 0.002, 3);
    scene.add(grid);
  }
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  function frameAll(box) {
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    controls.target.copy(c);
    camera.position.set(c.x - size * 0.05, size * 0.5 + 3, c.z + size * 0.55 + 3);
    controls.update();
  }

  return {
    THREE, renderer, scene, camera, controls, floor,
    frameAll,
    render() { controls.update(); renderer.render(scene, camera); labels.render(scene, camera); },
  };
}

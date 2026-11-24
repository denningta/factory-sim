// Procedural low-poly scale models (metres). Operator side of a bench is local +z,
// material flows along local +x.
import * as THREE from 'three';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...opts });
const M = {
  steel: mat(0x8d96a3, { metalness: 0.5, roughness: 0.45 }),
  dark: mat(0x3a4049, { metalness: 0.4 }),
  top: mat(0xd8c7a5, { roughness: 0.85 }),
  esd: mat(0x4a7a9c, { roughness: 0.8 }),
  yellow: mat(0xf2b705),
  machine: mat(0x5c87b8, { metalness: 0.3 }),
  oven: mat(0xb8bec7, { metalness: 0.6, roughness: 0.35 }),
  ovenDark: mat(0x2a2e35),
  wood: mat(0xb08550, { roughness: 0.95 }),
  wall: mat(0xc5cad2, { roughness: 0.9, transparent: true, opacity: 0.85 }),
  // Operator: neutral mannequin finish + plain workwear (ESD smock).
  mannequin: mat(0xb4b9c0, { roughness: 0.6, metalness: 0.05 }),
  smock: mat(0x2c3e57, { roughness: 0.88, metalness: 0 }),
  cuff: mat(0x1d2836, { roughness: 0.9, metalness: 0 }),
  pants: mat(0x33373d, { roughness: 0.9, metalness: 0 }),
  shoe: mat(0x1b1d20, { roughness: 0.6, metalness: 0.1 }),
  lens: mat(0x8fa3b5, { roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.45 }),
  frame: mat(0x2a2f36, { roughness: 0.5, metalness: 0.2 }),
};

function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function bench({ length = 1.5, depth = 0.75 } = {}) {
  const g = new THREE.Group();
  g.add(box(length, 0.05, depth, M.top, 0, 0.88, 0));
  g.add(box(length - 0.1, 0.02, depth - 0.12, M.esd, 0, 0.93, 0)); // ESD mat
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.05, 0.88, 0.05, M.steel, sx * (length / 2 - 0.06), 0, sz * (depth / 2 - 0.06)));
  }
  g.add(box(length - 0.1, 0.03, depth - 0.1, M.steel, 0, 0.18, 0)); // lower shelf
  // Overhead light bar and tool rail at the back
  g.add(box(0.04, 0.9, 0.04, M.steel, -length / 2 + 0.06, 0.93, -depth / 2 + 0.04));
  g.add(box(0.04, 0.9, 0.04, M.steel, length / 2 - 0.06, 0.93, -depth / 2 + 0.04));
  g.add(box(length - 0.08, 0.05, 0.12, M.dark, 0, 1.8, -depth / 2 + 0.04));
  return g;
}

// Bench-top press / tester.
export function benchMachine() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.08, 0.42, M.dark, 0, 0, 0));
  g.add(box(0.12, 0.55, 0.12, M.machine, 0, 0.08, -0.13));
  g.add(box(0.42, 0.18, 0.36, M.machine, 0, 0.5, -0.02));
  g.add(box(0.1, 0.06, 0.1, M.yellow, 0.16, 0.08, 0.14)); // palm button
  return g;
}

// Articulated operator figure, ~1.75 m, facing local -z. Proportions follow
// standing-workstation anthropometrics (elbow height ~1.08 m). Joints are
// groups so poseOperator() can blend between a working and a resting pose.
function limb(rTop, rBottom, len, m) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, len, 16);
  geo.translate(0, -len / 2, 0); // hangs down from its joint
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true;
  return mesh;
}
function ball(r, m, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  return mesh;
}

export function operator(badgeColor = 0x3a86ff) {
  const g = new THREE.Group();
  const joints = { shoulder: [], elbow: [] };

  // Legs and shoes
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.095, 0.92, 0);
    hip.add(limb(0.078, 0.06, 0.42, M.pants));
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    knee.add(ball(0.06, M.pants));
    knee.add(limb(0.058, 0.043, 0.43, M.pants));
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.16, 4, 12), M.shoe);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.set(1.05, 1, 0.72);
    shoe.position.set(0, -0.465, -0.045);
    shoe.castShadow = true;
    knee.add(shoe);
    hip.add(knee);
    g.add(hip);
  }

  // Upper body pivots at the hips so the figure can lean into the work.
  const waist = new THREE.Group();
  waist.position.y = 0.92;
  g.add(waist);

  // Smock: lathe profile (radius, height above hip), elliptical cross-section.
  const profile = [[0.205, -0.25], [0.2, -0.1], [0.18, 0.06], [0.19, 0.22], [0.2, 0.37], [0.188, 0.47], [0.13, 0.545], [0.055, 0.58]];
  const smock = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 28), M.smock);
  smock.scale.z = 0.62;
  smock.castShadow = true;
  waist.add(smock);
  // Front placket and ID badge
  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.66, 0.006), M.cuff);
  placket.position.set(0, 0.17, -0.121);
  waist.add(placket);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.008), mat(badgeColor, { roughness: 0.5 }));
  badge.position.set(0.085, 0.36, -0.124);
  waist.add(badge);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.01), mat(0xf2f2f2));
  clip.position.set(0.085, 0.403, -0.124);
  waist.add(clip);

  // Neck and head
  const neck = new THREE.Group();
  neck.position.y = 0.57;
  neck.add(limb(0.047, 0.05, 0.1, M.mannequin).translateY(0.1));
  const head = ball(0.1, M.mannequin, 0.95, 1.18, 1.05);
  head.position.y = 0.17;
  neck.add(head);
  // Safety glasses: clear lenses, thin frame and temples.
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.004), M.lens);
  lens.position.set(0, 0.183, -0.104);
  neck.add(lens);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.006, 0.008), M.frame);
  brow.position.set(0, 0.199, -0.103);
  neck.add(brow);
  for (const s of [-1, 1]) {
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.006, 0.1), M.frame);
    temple.position.set(s * 0.083, 0.197, -0.055);
    neck.add(temple);
  }
  waist.add(neck);

  // Arms (sleeves to the wrist, cuff, hand)
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.21, 0.5, 0);
    shoulder.userData.side = s;
    shoulder.add(ball(0.054, M.smock, 1, 0.9, 0.85));
    shoulder.add(limb(0.057, 0.047, 0.29, M.smock));
    const elbow = new THREE.Group();
    elbow.position.y = -0.29;
    elbow.add(ball(0.047, M.smock));
    elbow.add(limb(0.046, 0.039, 0.23, M.smock));
    const cuff = limb(0.041, 0.041, 0.025, M.cuff);
    cuff.position.y = -0.225;
    elbow.add(cuff);
    const hand = ball(0.042, M.mannequin, 0.75, 1.35, 0.55);
    hand.position.y = -0.3;
    elbow.add(hand);
    shoulder.add(elbow);
    waist.add(shoulder);
    joints.shoulder.push(shoulder);
    joints.elbow.push(elbow);
  }

  g.userData.rig = { waist, neck, ...joints, w: 0 };
  poseOperator(g, 0, 0);
  return g;
}

// w: 0 = resting (arms at sides), 1 = working at the bench. t: seconds of
// real time, drives a small alternating hand motion while working.
export function poseOperator(op, w, t) {
  const r = op.userData.rig;
  r.waist.rotation.x = -0.1 * w;
  r.neck.rotation.x = -0.32 * w;
  r.shoulder.forEach((sh, i) => {
    const s = sh.userData.side;
    const phase = t * 2.1 + i * Math.PI;
    sh.rotation.set(0.05 + 0.27 * w + 0.06 * w * Math.sin(phase), -s * 0.32 * w, s * (0.07 + 0.05 * w));
    r.elbow[i].rotation.x = 0.1 + 1.08 * w + 0.12 * w * Math.sin(phase + 0.6);
  });
}

// Gravity flow rack: buffer / supermarket. Slots via rackSlot().
export function rack({ width = 1.0 } = {}) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.04, 1.3, 0.04, M.steel, sx * (width / 2), 0, sz * 0.3));
  }
  for (let i = 0; i < 3; i++) {
    const shelf = box(width, 0.03, 0.62, M.dark, 0, 0.25 + i * 0.4, 0);
    shelf.rotation.x = 0.08;
    g.add(shelf);
  }
  const sign = box(width * 0.6, 0.12, 0.02, M.yellow, 0, 1.3, 0.31);
  g.add(sign);
  return g;
}
export function rackSlot(i, width = 1.0) {
  const perRow = Math.max(1, Math.floor(width / 0.2)), perShelf = perRow * 3;
  const shelf = Math.floor(i / perShelf) % 3, k = i % perShelf;
  const layer = Math.floor(i / (perShelf * 3));
  return new THREE.Vector3(-width / 2 + 0.12 + (k % perRow) * 0.2, 0.36 + shelf * 0.4 + layer * 0.17, -0.2 + Math.floor(k / perRow) * 0.2);
}

export function oven() {
  const g = new THREE.Group();
  g.add(box(3.0, 0.1, 2.0, M.dark, 0, 0, 0));
  g.add(box(3.0, 2.2, 0.08, M.oven, 0, 0.1, -0.96)); // back
  g.add(box(0.08, 2.2, 2.0, M.oven, -1.46, 0.1, 0));
  g.add(box(0.08, 2.2, 2.0, M.oven, 1.46, 0.1, 0));
  g.add(box(3.0, 0.1, 2.0, M.oven, 0, 2.3, 0)); // roof
  g.add(box(0.3, 1.0, 0.3, M.oven, 1.0, 2.4, -0.5)); // stack
  const door = box(2.9, 2.0, 0.06, M.ovenDark, 0, 0.15, 0.98);
  door.material = M.ovenDark.clone();
  door.material.transparent = true;
  door.material.opacity = 0.35;
  g.add(door);
  g.userData.door = door;
  const panel = box(0.4, 0.6, 0.15, M.machine, 1.75, 0.8, 0.7);
  g.add(panel);
  return g;
}
export function ovenSlot(i) {
  const col = i % 5, row = Math.floor(i / 5) % 4, layer = Math.floor(i / 20);
  return new THREE.Vector3(-1.0 + col * 0.5, 0.35 + row * 0.45 + layer * 0.18, 0);
}

export function pallet() {
  const g = new THREE.Group();
  for (const z of [-0.45, 0, 0.45]) g.add(box(1.2, 0.1, 0.12, M.wood, 0, 0, z));
  for (let i = 0; i < 7; i++) g.add(box(0.14, 0.03, 1.0, M.wood, -0.52 + i * 0.173, 0.1, 0));
  return g;
}
export function palletSlot(i) {
  const k = i % 25, layer = Math.floor(i / 25);
  return new THREE.Vector3(-0.44 + (k % 5) * 0.22, 0.22 + layer * 0.18, -0.4 + Math.floor(k / 5) * 0.2);
}

export function cart() {
  const g = new THREE.Group();
  g.add(box(1.0, 0.04, 0.6, M.steel, 0, 0.2, 0));
  g.add(box(1.0, 0.04, 0.6, M.steel, 0, 0.75, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.03, 0.95, 0.03, M.steel, sx * 0.48, 0.05, sz * 0.28));
  g.add(box(0.03, 0.4, 0.5, M.dark, -0.5, 0.95, 0));
  return g;
}

export function machine() {
  const g = new THREE.Group();
  g.add(box(1.4, 1.8, 1.2, M.machine, 0, 0, 0));
  g.add(box(0.8, 0.6, 0.05, M.ovenDark, 0, 0.9, 0.6));
  g.add(box(0.3, 0.5, 0.2, M.dark, 0.85, 1.0, 0.4));
  return g;
}

export function wall() {
  const g = new THREE.Group();
  g.add(box(3, 2.4, 0.12, M.wall, 0, 0, 0));
  return g;
}

export function aisle() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), mat(0xf2b705, { transparent: true, opacity: 0.35 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.receiveShadow = true;
  g.add(m);
  return g;
}

// ---------------------------------------------------------------- composite / production equipment
const M2 = {
  white: mat(0xe9ecef, { roughness: 0.6 }),
  alu: mat(0xc3c9d1, { metalness: 0.7, roughness: 0.35 }),
  glass: mat(0xbfd6e6, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.28 }),
  prepreg: mat(0x1c1f24, { roughness: 0.5, metalness: 0.2 }),
  vessel: mat(0xa9b1bb, { metalness: 0.75, roughness: 0.32 }),
  band: mat(0x6f7884, { metalness: 0.6, roughness: 0.4 }),
  rail: mat(0x55606c, { metalness: 0.7, roughness: 0.4 }),
  cabinet: mat(0xd5d9de, { roughness: 0.55 }),
  screen: mat(0x1f3b57, { roughness: 0.2, emissive: 0x0d2236, emissiveIntensity: 0.6 }),
  green: mat(0x3b7a57, { roughness: 0.6 }),
};

// Cleanroom layup table with aluminium tool plate and overhead light canopy.
export function layupTable() {
  const g = new THREE.Group();
  g.add(box(3.0, 0.06, 1.6, M2.white, 0, 0.84, 0));
  g.add(box(2.4, 0.03, 1.1, M2.alu, -0.1, 0.9, 0)); // tool plate
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.07, 0.84, 0.07, M.steel, sx * 1.42, 0, sz * 0.72));
  g.add(box(2.9, 0.04, 1.5, M.steel, 0, 0.2, 0));
  for (const sx of [-1, 1]) g.add(box(0.05, 1.5, 0.05, M.steel, sx * 1.42, 0.9, -0.74));
  g.add(box(3.0, 0.08, 0.5, M2.white, 0, 2.4, -0.5)); // light canopy
  const lamp = box(2.6, 0.02, 0.3, mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), 0, 2.38, -0.5);
  g.add(lamp);
  g.add(box(0.5, 0.25, 0.35, M.dark, 1.15, 0.9, -0.55)); // vacuum gauge / pump
  return g;
}

// CNC ply cutting table: conveyor bed, travelling gantry, prepreg roll.
export function plyCutter() {
  const g = new THREE.Group();
  g.add(box(3.2, 0.08, 1.8, M2.prepreg, 0, 0.82, 0));
  g.add(box(3.2, 0.82, 1.8, M2.white, 0, 0, 0));
  const gantry = new THREE.Group();
  gantry.add(box(0.18, 0.5, 0.18, M2.white, 0, 0.9, -0.95));
  gantry.add(box(0.18, 0.5, 0.18, M2.white, 0, 0.9, 0.95));
  gantry.add(box(0.22, 0.16, 2.1, M2.white, 0, 1.4, 0));
  gantry.add(box(0.16, 0.22, 0.16, mat(0xd35400), 0, 1.2, 0.2)); // cutting head
  g.add(gantry);
  g.userData.gantry = gantry;
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.7, 20), M2.prepreg);
  roll.rotation.x = Math.PI / 2;
  roll.position.set(-1.75, 1.0, 0);
  roll.castShadow = true;
  g.add(roll);
  g.add(box(0.1, 0.95, 0.1, M.steel, -1.75, 0, -0.9));
  g.add(box(0.1, 0.95, 0.1, M.steel, -1.75, 0, 0.9));
  g.add(box(0.4, 1.2, 0.4, M2.cabinet, 1.4, 0, -1.15)); // controller
  g.add(box(0.32, 0.22, 0.03, M2.screen, 1.4, 1.0, -0.94));
  return g;
}

// Enclosed CNC router / trim cell with window and spindle.
export function cncRouter() {
  const g = new THREE.Group();
  g.add(box(3.0, 0.15, 2.2, M.dark, 0, 0, 0));
  g.add(box(3.0, 2.3, 0.08, M2.cabinet, 0, 0.15, -1.06));
  g.add(box(0.08, 2.3, 2.2, M2.cabinet, -1.46, 0.15, 0));
  g.add(box(0.08, 2.3, 2.2, M2.cabinet, 1.46, 0.15, 0));
  g.add(box(3.0, 0.1, 2.2, M2.cabinet, 0, 2.45, 0));
  g.add(box(2.84, 1.3, 0.04, M2.glass, 0, 0.95, 1.08)); // window
  g.add(box(3.0, 0.8, 0.08, M2.cabinet, 0, 0.15, 1.06));
  g.add(box(2.2, 0.08, 1.4, M.steel, 0, 0.85, 0)); // bed
  const spindle = new THREE.Group();
  spindle.add(box(2.6, 0.14, 0.2, M2.white, 0, 2.0, 0));
  spindle.add(box(0.22, 0.6, 0.22, mat(0xc0392b), 0, 1.4, 0.1));
  g.add(spindle);
  g.userData.spindle = spindle;
  g.add(box(0.4, 0.5, 0.15, M2.cabinet, 1.75, 1.0, 1.0)); // pendant
  g.add(box(0.3, 0.2, 0.02, M2.screen, 1.75, 1.25, 1.08));
  return g;
}

// Ultrasonic NDI station: immersion tank / table with scanning gantry.
export function inspection() {
  const g = new THREE.Group();
  g.add(box(2.4, 0.85, 1.4, M2.white, 0, 0, 0));
  g.add(box(2.2, 0.05, 1.2, mat(0x2d6a8a, { transparent: true, opacity: 0.6 }), 0, 0.82, 0)); // water
  for (const sz of [-1, 1]) g.add(box(2.4, 0.06, 0.08, M2.alu, 0, 1.3, sz * 0.72));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.06, 0.46, 0.06, M2.alu, sx * 1.17, 0.85, sz * 0.72));
  const bridge = new THREE.Group();
  bridge.add(box(0.12, 0.08, 1.56, M2.white, 0, 1.36, 0));
  bridge.add(box(0.08, 0.45, 0.08, mat(0xf2b705), 0, 0.95, 0));
  g.add(bridge);
  g.userData.gantry = bridge;
  g.add(box(0.06, 1.3, 0.06, M.steel, 1.5, 0, 0.6)); // monitor stand
  g.add(box(0.55, 0.36, 0.04, M2.screen, 1.5, 1.3, 0.6));
  return g;
}

// Horizontal autoclave. Vessel axis along local x, door at the -x end, rails
// and load cart outside the door. diameter / length in metres.
export function autoclave({ diameter = 2.4, length = 6.0 } = {}) {
  const g = new THREE.Group();
  const R = diameter / 2 + 0.12; // shell outer radius incl. insulation
  const cy = R + 0.45;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, length, 40, 1, true), M2.vessel);
  shell.rotation.z = Math.PI / 2;
  shell.position.y = cy;
  shell.castShadow = true;
  g.add(shell);
  // Elliptical rear head
  const head = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M2.vessel);
  head.rotation.z = -Math.PI / 2;
  head.scale.set(1, 0.45, 1);
  head.position.set(length / 2, cy, 0);
  head.castShadow = true;
  g.add(head);
  // Stiffening bands
  for (let i = 0; i <= 4; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.04, 8, 48), M2.band);
    band.rotation.y = Math.PI / 2;
    band.position.set(-length / 2 + 0.3 + i * (length - 0.6) / 4, cy, 0);
    g.add(band);
  }
  // Door flange (breech-lock ring) and door on a hinge arm
  const flange = new THREE.Mesh(new THREE.TorusGeometry(R + 0.04, 0.11, 12, 48), M2.band);
  flange.rotation.y = Math.PI / 2;
  flange.position.set(-length / 2, cy, 0);
  g.add(flange);
  const hinge = new THREE.Group();
  hinge.position.set(-length / 2 - 0.1, cy, R + 0.1);
  const door = new THREE.Mesh(new THREE.SphereGeometry(R + 0.02, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), M2.vessel);
  door.rotation.z = Math.PI / 2;
  door.scale.set(1, 0.32, 1);
  door.position.set(0, 0, -(R + 0.1));
  door.castShadow = true;
  hinge.add(door);
  hinge.add(box(0.12, 0.2, R + 0.1, M2.band, -0.1, -0.1, -(R + 0.1) / 2));
  g.add(hinge);
  g.userData.doorHinge = hinge;
  // Saddle supports
  for (const x of [-length * 0.32, length * 0.32]) {
    g.add(box(0.35, cy - R * 0.55, R * 1.5, M.dark, x, 0, 0));
  }
  // Interior rails (visible through the open door) and floor rails outside
  for (const sz of [-0.45, 0.45]) {
    g.add(box(length, 0.05, 0.06, M2.rail, 0, cy - R * 0.62, sz));
    g.add(box(3.4, 0.05, 0.06, M2.rail, -length / 2 - 1.8, 0, sz));
  }
  // Load cart with tool plates
  const cart = new THREE.Group();
  cart.add(box(2.6, 0.08, 1.1, M.steel, 0, 0.18, 0));
  cart.add(box(2.4, 0.03, 1.0, M2.alu, 0, 0.62, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cart.add(box(0.05, 0.5, 0.05, M.steel, sx * 1.25, 0.18, sz * 0.5));
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), M.dark);
    w.rotation.x = Math.PI / 2;
    w.position.set(sx * 1.0, 0.09, sz * 0.45);
    cart.add(w);
  }
  cart.position.set(-length / 2 - 1.8, 0, 0);
  g.add(cart);
  g.userData.cart = cart;
  g.userData.cartOut = -length / 2 - 1.8;
  g.userData.cartIn = 0;
  g.userData.cartY = cy - R * 0.62 - 0.02; // rail height inside the vessel
  // Control cabinet and pipework
  g.add(box(1.2, 2.0, 0.5, M2.cabinet, -length / 2 + 0.6, 0, -R - 0.75));
  g.add(box(0.5, 0.35, 0.03, M2.screen, -length / 2 + 0.6, 1.35, -R - 0.49));
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, length * 0.8, 12), M2.band);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0, cy + R + 0.12, -0.3);
  g.add(pipe);
  g.userData.R = R; g.userData.length = length; g.userData.cy = cy;
  return g;
}
// Slot on the load cart (cart-local): 3 across, up to 4 along, then a second level.
export function cartSlot(i) {
  const col = i % 3, row = Math.floor(i / 3) % 4, level = Math.floor(i / 12);
  return new THREE.Vector3(-0.9 + row * 0.6, 0.72 + level * 0.32, -0.33 + col * 0.33);
}

export const PROP_BUILDERS = {
  bench: { label: 'Bench', make: () => bench() },
  rack: { label: 'Flow rack', make: () => rack() },
  machine: { label: 'Machine', make: () => machine() },
  oven: { label: 'Oven', make: () => oven() },
  pallet: { label: 'Pallet', make: () => pallet() },
  cart: { label: 'Cart', make: () => cart() },
  wall: { label: 'Wall', make: () => wall() },
  aisle: { label: 'Aisle', make: () => aisle() },
};

// Andon stack light: post, base, one lens that takes the state color, cap.
export function statusLight() {
  const g = new THREE.Group();
  g.add(box(0.025, 0.42, 0.025, M.steel, 0, 0, 0));
  const cyl = (r, h, m, y) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), m);
    c.position.y = y + h / 2;
    c.castShadow = true;
    g.add(c);
    return c;
  };
  cyl(0.04, 0.03, M.dark, 0.42);
  const lamp = cyl(0.036, 0.11, new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0x000000, roughness: 0.3, transparent: true, opacity: 0.92 }), 0.45);
  cyl(0.036, 0.05, mat(0xd9dde2, { roughness: 0.4 }), 0.56); // unlit segment
  cyl(0.04, 0.02, M.dark, 0.61);
  g.userData.lamp = lamp;
  return g;
}

export const OPERATOR_COLORS = [0xc0392b, 0x2a7f9e, 0x7d5ba6, 0xc98a1b, 0x3d7d4f, 0x8e5a3c, 0x4f6d8f, 0x9c4f6e, 0x5f7f2a, 0x6b6f76];

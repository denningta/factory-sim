import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { bench, type Config } from './bench';
import { equipment, LOOP_PERIOD, tracks } from './layout';
import { createCursor, positionAt } from './tracks';

// "Detailed" machine: ~1.5k triangles, standing in for a real equipment model.
function detailedGeometry(): THREE.BufferGeometry {
  const body = new THREE.BoxGeometry(2, 1.2, 1.4).translate(0, 0.6, 0);
  const drum = new THREE.CylinderGeometry(0.5, 0.5, 1.6, 48)
    .rotateZ(Math.PI / 2)
    .translate(0, 1.6, 0);
  const dome = new THREE.SphereGeometry(0.35, 24, 16).translate(0.6, 2.2, 0);
  const merged = mergeGeometries([body, drum, dome]);
  return merged;
}
function mergeGeometries(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = gs.map((g) => g.toNonIndexed());
  const total = parts.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    const p = g.getAttribute('position').array;
    const n = g.getAttribute('normal').array;
    pos.set(p as Float32Array, o);
    nor.set(n as Float32Array, o);
    o += p.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
const lowGeometry = () => new THREE.BoxGeometry(2, 2.4, 1.4).translate(0, 1.2, 0); // 12 tris
const partGeometry = () => new THREE.IcosahedronGeometry(0.25, 2); // 320 tris
const LOD_DISTANCE = 45; // m

const dummy = new THREE.Object3D();

// Instance matrices are rewritten every frame: tell the driver (StaticDraw stalls on Mesa).
const dynamic = (m: THREE.InstancedMesh | null) =>
  m?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

function Equipment({ config }: { config: Config }) {
  const camera = useThree((s) => s.camera);
  const hi = useRef<THREE.InstancedMesh>(null);
  const lo = useRef<THREE.InstancedMesh>(null);
  const naive = useRef<(THREE.Mesh | null)[]>([]);
  const geos = useMemo(() => ({ hi: detailedGeometry(), lo: lowGeometry() }), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6c8cb0' }), []);

  useFrame(() => {
    if (config.mode === 'naive') {
      // Naive three.js LOD = per-object distance check swapping geometry.
      naive.current.forEach((m, i) => {
        if (!m) return;
        const e = equipment[i]!;
        const far =
          config.lod && Math.hypot(camera.position.x - e.x, camera.position.z - e.z) > LOD_DISTANCE;
        m.geometry = far ? geos.lo : geos.hi;
      });
      return;
    }
    const h = hi.current;
    const l = lo.current;
    if (!h || !l) return;
    let nh = 0;
    let nl = 0;
    for (const e of equipment) {
      dummy.position.set(e.x, 0, e.z);
      dummy.updateMatrix();
      const far =
        config.lod && Math.hypot(camera.position.x - e.x, camera.position.z - e.z) > LOD_DISTANCE;
      if (far) l.setMatrixAt(nl++, dummy.matrix);
      else h.setMatrixAt(nh++, dummy.matrix);
    }
    h.count = nh;
    l.count = nl;
    h.instanceMatrix.needsUpdate = true;
    l.instanceMatrix.needsUpdate = true;
  });

  if (config.mode === 'naive') {
    return (
      <group>
        {equipment.map((e, i) => (
          <mesh
            key={i}
            ref={(m) => void (naive.current[i] = m)}
            frustumCulled={false} // worst case: everything on screen, same as the instanced path
            geometry={geos.hi}
            material={mat}
            position={[e.x, 0, e.z]}
          />
        ))}
      </group>
    );
  }
  return (
    <group>
      <instancedMesh
        ref={(m) => {
          hi.current = m;
          dynamic(m);
        }}
        args={[geos.hi, mat, equipment.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={(m) => {
          lo.current = m;
          dynamic(m);
        }}
        args={[geos.lo, mat, equipment.length]}
        frustumCulled={false}
      />
    </group>
  );
}

function Parts({ config }: { config: Config }) {
  const inst = useRef<THREE.InstancedMesh>(null);
  const naive = useRef<(THREE.Mesh | null)[]>([]);
  const geo = useMemo(partGeometry, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e0a040' }), []);
  const cursors = useMemo(() => tracks.map(createCursor), []);
  const out = useMemo(() => ({ x: 0, z: 0 }), []);
  const clock = useRef(0);

  useEffect(() => {
    clock.current = 0;
  }, [config.mode]);

  useFrame((_, dt) => {
    // Renderer's own clock, independent of sim time (ADR-0008).
    clock.current = (clock.current + dt) % (LOOP_PERIOD - 1);
    const t = clock.current;
    if (config.mode === 'naive') {
      tracks.forEach((tr, i) => {
        const m = naive.current[i];
        if (!m) return;
        positionAt(tr, cursors[i]!, t, out);
        m.position.set(out.x, 0.8, out.z);
      });
      return;
    }
    const mesh = inst.current;
    if (!mesh) return;
    for (let i = 0; i < tracks.length; i++) {
      positionAt(tracks[i]!, cursors[i]!, t, out);
      dummy.position.set(out.x, 0.8, out.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (config.mode === 'naive') {
    return (
      <group>
        {tracks.map((_, i) => (
          <mesh
            key={i}
            ref={(m) => void (naive.current[i] = m)}
            frustumCulled={false}
            geometry={geo}
            material={mat}
          />
        ))}
      </group>
    );
  }
  return (
    <instancedMesh
      ref={(m) => {
        inst.current = m;
        dynamic(m);
      }}
      args={[geo, mat, tracks.length]}
      frustumCulled={false}
    />
  );
}

/** Records frame times and renderer stats into the shared bench object. */
function Probe() {
  // JS cost of the scene updates (positions, LOD, matrix writes); excludes GL submit.
  useFrame(() => {
    bench.updateStart = performance.now();
  }, -1000);
  const gl = useThree((s) => s.gl);
  useFrame((_, dt) => {
    bench.updateMs.push(performance.now() - bench.updateStart);
    if (bench.updateMs.length > 600) bench.updateMs.shift();
    bench.frameTimes.push(dt * 1000);
    if (bench.frameTimes.length > 600) bench.frameTimes.shift();
    bench.info.calls = gl.info.render.calls;
    bench.info.triangles = gl.info.render.triangles;
  });
  return null;
}

const q = new URLSearchParams(location.search);

export function Scene({ config }: { config: Config }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[30, 60, 20]} intensity={1.2} />
      <gridHelper args={[160, 32, '#444', '#2a2a2a']} />
      <Equipment
        key={config.mode}
        config={{ ...config, mode: (q.get('eq') as Config['mode']) ?? config.mode }}
      />
      <Parts
        key={`p${config.mode}`}
        config={{ ...config, mode: (q.get('pt') as Config['mode']) ?? config.mode }}
      />
      <Probe key={`pr${config.mode}`} />
    </>
  );
}

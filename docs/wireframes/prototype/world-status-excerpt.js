// Excerpt from the prototype's src/render/world.js: state colours/text, per-equipment anchors (SPECS),
// and how the stack light and label are updated each frame. Reference only; not imported anywhere.

// ---- Lines 1-33
// Builds the 3D line from the operation graph + saved layout, draws flow
// arrows between operations, and animates parts, operators, machines and the
// autoclave from engine state every frame.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as Models from './models.js';
import { css } from './scene.js';
import { EQUIPMENT } from '../sim/catalog.js';
import { topoLayers } from '../sim/model.js';

const STATE_VAR = {
  working: '--working', waitMachine: '--blocked', blocked: '--blocked', starved: '--starved',
  idle: '--idle', down: '--down', waitOperator: '--blocked',
  loading: '--batch', curing: '--batch', cooling: '--batch', unloading: '--batch', waitLaunch: '--starved', filling: '--starved',
};
export const STATE_TEXT = {
  working: 'working', waitMachine: 'waiting on machine', blocked: 'blocked', starved: 'starved', idle: 'idle',
  down: 'DOWN', waitOperator: 'waiting for operator',
  loading: 'loading', curing: 'curing', cooling: 'cooling', unloading: 'unloading', waitLaunch: 'waiting to launch', filling: 'filling',
};
const MAX_PARTS = 6000;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Local anchors per equipment type (operator side +z, flow +x).
const SPECS = {
  bench: { len: 1.5, depth: 0.75, y: 0.995, work: [-0.12, 0.12], mach: null, inS: [-0.5, 0.05], outS: [0.52, 0.17], opZ: 0.72, cols: 3 },
  benchMachine: { len: 1.5, depth: 0.75, y: 0.995, work: [-0.12, 0.12], mach: [0.42, 1.08, -0.1], inS: [-0.5, 0.05], outS: [0.52, 0.17], opZ: 0.72, cols: 3 },
  layupTable: { len: 3.0, depth: 1.6, y: 0.935, work: [-0.1, 0.05], mach: [-0.1, 0.95, 0.05], inS: [-1.25, 0.45], outS: [1.15, 0.45], opZ: 1.15, cols: 2 },
  plyCutter: { len: 3.2, depth: 1.8, y: 0.915, work: [0.9, 0.5], mach: [-0.2, 0.92, 0], inS: [1.35, -0.55], outS: [1.35, 0.55], opZ: 1.25, cols: 2 },
  cncRouter: { len: 3.0, depth: 2.2, y: 0.95, work: [0, 0.2], mach: [0, 0.95, 0], inS: [-2.0, 0.9], outS: [2.0, 0.9], opZ: 1.6, cols: 2, floorQ: true },
  inspection: { len: 2.4, depth: 1.4, y: 0.88, work: [-0.3, 0.2], mach: [0, 0.86, 0], inS: [-1.6, 0.7], outS: [1.6, 0.7], opZ: 1.05, cols: 2, floorQ: true },
  machine: { len: 1.4, depth: 1.2, y: 1.0, work: [0, 0.75], mach: [0, 1.0, 0.65], inS: [-1.0, 0.6], outS: [1.0, 0.6], opZ: 1.1, cols: 3, floorQ: true },
};

// ---- Lines 525-595
          put(p, g, inGroup(g, ud.cart, local));
        });
        const door = ud.oven.userData.door;
        const running = ['ramp', 'dwell', 'cool'].includes(n.phase);
        door.material.emissive.set(running ? 0xff6a00 : 0x000000);
        door.material.emissiveIntensity = running ? 0.6 : 0;
      }
      const c = colors[n.state] || colors.idle;
      ud.lamp.material.color.copy(c);
      ud.lamp.material.emissive.copy(c).multiplyScalar(0.8);
    }
    // Finished goods pallets
    for (const n of E.nodes) {
      if (n.outputs.length) continue;
      const g = groups.get(`ship:${n.id}`);
      if (g) E.fg.forEach((p, i) => put(p, g, Models.palletSlot(i)));
    }
    for (const id of visual.keys()) if (!seen.has(id)) visual.delete(id);
    partMesh.count = count;
    partMesh.instanceMatrix.needsUpdate = true;
    if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
    if (selectedBox) selectedBox.update();
  }

  const fmt = (s) => {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${String(m).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
  };
  const per = (s) => (s >= 120 ? `${(s / 60).toFixed(1)} min` : `${s.toFixed(0)} s`);

  function updateLabels(E, stats) {
    if (!line) return;
    updateArrows(E);
    for (const n of E.nodes) {
      const g = groups.get(n.id);
      if (!g) continue;
      const s = stats?.stations.find((x) => x.id === n.id);
      const st = `<span class="st" style="color:${css(STATE_VAR[n.state] || '--idle')}">● ${STATE_TEXT[n.state] || n.state}</span>`;
      let html = `<b>${n.label}</b> `;
      if (n.kind === 'station') {
        html += `${per(n.times.perPiece)}/pc`;
        if (n.staff > 1 || n.stations > 1) html += ` <span class="st">${n.staff}p × ${n.stations}st</span>`;
        if (n.processBatch > 1 || n.transferBatch > 1) html += ` <span class="st">batch ${n.processBatch}/${n.transferBatch}</span>`;
        html += `<br>${st}`;
        if (s?.fractions?.working != null) html += ` <span class="st">· ${(s.fractions.working * 100).toFixed(0)}% busy</span>`;
      } else {
        const b = n.batchRule;
        const load = n.inside.length || n.staged.length;
        html += `<span class="st">${load}/${b.capacity} · ${b.policy === 'full' ? 'full load' : b.policy === 'minWait' ? `min ${b.minLoad}, wait ${b.maxWaitMin} min` : 'schedule'}</span><br>${st}`;
        if (['load', 'ramp', 'dwell', 'cool', 'unload'].includes(n.phase)) {
          const c = b.cycle;
          const order = ['load', 'ramp', 'dwell', 'cool', 'unload'];
          const mins = { load: c.loadMin, ramp: c.rampMin, dwell: c.dwellMin, cool: c.coolMin, unload: c.unloadMin };
          let left = n.phaseEnd - E.now;
          for (let i = order.indexOf(n.phase) + 1; i < order.length; i++) left += (mins[order[i]] || 0) * 60;
          html += ` <span class="st">· ${n.phase} · ${fmt(left)} left</span>`;
        }
        if (s?.cures) html += ` <span class="st">· ${s.cures} loads, ${(s.avgFill * 100).toFixed(0)}% full</span>`;
        if (n.expired) html += ` <span class="st" style="color:var(--down)">· ${n.expired} over out-time</span>`;
      }
      const q = n.q.reduce((a, x) => a + x.length, 0) + n.rq.length;
      if (q) html += ` <span class="st">· queue ${q}</span>`;
      g.userData.label.innerHTML = html;
    }
    for (const n of E.nodes) {
      if (n.outputs.length) continue;
      const g = groups.get(`ship:${n.id}`);
      if (g) g.userData.label.innerHTML = `<b>Finished goods</b> <span class="st">${E.shipped.length} shipped</span>`;
    }
  }

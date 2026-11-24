// Property inspector: every property of the selected operation (or pallet /
// floor prop). Each change goes through h.onEdit / h.onScenario so main.js
// can snapshot for undo and rebuild the line.
import { EQUIPMENT, suggestCapacity } from '../sim/catalog.js';
import { crewOf, elementTable, lineTimes, opTimes } from '../sim/model.js';
import { PROP_BUILDERS } from '../render/models.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const per = (s) => (s >= 120 ? `${(s / 60).toFixed(1)} min` : `${s.toFixed(1)} s`);

function getPath(o, path) { return path.split('.').reduce((a, k) => a?.[k], o); }
function setPath(o, path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  const t = ks.reduce((a, k) => (a[k] ??= {}), o);
  t[last] = v;
}

export function createInspector(box, h) {
  let current = null;

  function show(target, scn, stats) {
    current = target;
    if (!target) { box.innerHTML = ''; return; }
    if (target.kind === 'prop') return showProp(target);
    if (target.kind === 'pallet') return showPallet(target);
    const op = scn.operations.find((o) => o.id === target.id);
    if (!op) { box.innerHTML = ''; return; }
    const els = elementTable(scn);
    const t = opTimes(op, els);
    const { takt } = lineTimes(scn);
    const isBatch = !!op.batchRule;
    const others = scn.operations.filter((o) => o.id !== op.id);
    const opOpts = (sel, blank) => (blank ? `<option value="">${blank}</option>` : '') +
      others.map((o) => `<option value="${esc(o.id)}" ${o.id === sel ? 'selected' : ''}>${esc(o.name)}</option>`).join('');
    const num = (label, path, { min = 0, max = '', step = 1, scale = 1, unit = '', title = '' } = {}) => {
      const v = getPath(op, path);
      return `<label class="f" title="${esc(title)}"><span>${label}</span><span class="fi"><input type="number" data-p="${path}" data-scale="${scale}" min="${min}" max="${max}" step="${step}" value="${v == null ? '' : +(v / scale).toFixed(3)}">${unit ? `<em>${unit}</em>` : ''}</span></label>`;
    };
    const sel = (label, path, options) => `<label class="f"><span>${label}</span><select data-p="${path}">${options.map(([v, l]) => `<option value="${esc(v)}" ${getPath(op, path) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
    const chk = (label, path) => `<label class="f"><span>${label}</span><input type="checkbox" data-p="${path}" ${getPath(op, path) ? 'checked' : ''}></label>`;
    const st = stats?.stations.find((s) => s.id === op.id);
    const groups = [...new Set([...Object.keys(scn.groups), ...scn.operations.map((o) => o.group).filter(Boolean)])];

    let html = `<div class="insp-head"><b>${esc(op.name)}</b> <span class="sub">${esc(EQUIPMENT[op.equipment]?.label)}</span></div>
      <p class="sub" style="margin:2px 0 6px">${per(t.perPiece)} per piece${t.perPiece > takt + 1e-6 ? ' <b style="color:var(--takt)">over takt</b>' : ''} · takt ${per(takt)}</p>`;

    html += `<details open><summary>General</summary>
      <label class="f"><span>Name</span><input type="text" data-p="name" value="${esc(op.name)}"></label>
      <label class="f"><span>ID</span><input type="text" data-act="rename" value="${esc(op.id)}"></label>
      <label class="f"><span>Equipment</span><select data-act="equipment">${Object.entries(EQUIPMENT).map(([k, e]) => `<option value="${k}" ${k === op.equipment ? 'selected' : ''}>${esc(e.label)}</option>`).join('')}</select></label>
      <label class="f"><span>Group (yamazumi)</span><input type="text" data-p="group" list="grpList" value="${esc(op.group)}"><datalist id="grpList">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist></label>
    </details>`;

    html += `<details open><summary>Capacity</summary>
      ${num('Staff (people)', 'staff', { max: 30, title: isBatch ? 'People assigned; needed for load and unload' : 'People working this operation' })}
      ${isBatch ? '' : num('Parallel stations', 'stations', { min: 1, max: 10 })}
      <p class="sub">${isBatch ? `Cycle ${per(t.cycleSec)} per load of ${op.batchRule.capacity} = ${per(t.perPiece)} per piece.` :
        `Crew per station: ${crewOf(op) || 'none (automatic)'} · manual ${per(t.manualPerPiece)}/pc · machine ${per(t.machinePerPiece)}/pc`}</p>
    </details>`;

    if (!isBatch) {
      html += `<details open><summary>Work elements (${op.elements.length})</summary><table class="mini"><thead><tr><th>Element</th><th title="Manual seconds (lowest repeatable)">Man s</th><th title="Manual time per piece or once per batch">per</th><th title="Machine seconds">Mc s</th><th>per</th><th></th></tr></thead><tbody>`;
      op.elements.forEach((id, i) => {
        const e = scn.elements.find((x) => x.id === id);
        if (!e) { html += `<tr><td colspan="6" class="warn">Missing element ${esc(id)}</td></tr>`; return; }
        const m = els.get(id);
        const usedBy = scn.operations.filter((o) => o.elements.includes(id)).length;
        const obsM = Array.isArray(e.manual) ? ` title="${e.manual.length} observations; LR shown. Typing a value replaces them."` : '';
        const obsK = Array.isArray(e.machine) ? ` title="${e.machine.length} observations; LR shown."` : '';
        html += `<tr data-el="${esc(id)}">
          <td><input type="text" data-e="name" value="${esc(e.name)}" title="${usedBy > 1 ? `Shared by ${usedBy} operations` : ''}">${usedBy > 1 ? '<em class="shared">shared</em>' : ''}</td>
          <td><input type="number" min="0" step="0.1" data-e="manual" value="${m.manual ? +m.manual.lr.toFixed(1) : 0}"${obsM}></td>
          <td><select data-e="manualPer"><option value="piece" ${m.manualPer !== 'batch' ? 'selected' : ''}>pc</option><option value="batch" ${m.manualPer === 'batch' ? 'selected' : ''}>batch</option></select></td>
          <td><input type="number" min="0" step="0.1" data-e="machine" value="${m.machine ? +m.machine.lr.toFixed(1) : 0}"${obsK}></td>
          <td><select data-e="machinePer"><option value="batch" ${m.machinePer !== 'piece' ? 'selected' : ''}>batch</option><option value="piece" ${m.machinePer === 'piece' ? 'selected' : ''}>pc</option></select></td>
          <td class="nowrap"><button data-el-act="up" data-i="${i}" title="Move up">▲</button><button data-el-act="rm" data-i="${i}" title="Remove from this operation">✕</button></td></tr>`;
      });
      const unused = scn.elements.filter((e) => !op.elements.includes(e.id));
      html += `</tbody></table><div class="row" style="margin-top:4px"><button data-el-act="new">+ New element</button>
        ${unused.length ? `<select data-el-act="lib" style="width:auto"><option value="">+ From library…</option>${unused.map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select>` : ''}</div></details>`;
    }

    html += `<details open><summary>Batching</summary>`;
    if (!isBatch) html += num('Process batch', 'processBatch', { min: 1, max: 100, title: 'Parts processed together in one cycle' });
    html += num('Transfer batch', 'transferBatch', { min: 1, max: 100, title: 'Parts moved together to the next operation' });
    if (isBatch) {
      const b = op.batchRule;
      html += sel('Launch rule', 'batchRule.policy', [['full', 'Full load only'], ['minWait', 'Min load + max wait'], ['schedule', 'Fixed cure schedule']]);
      html += num('Load capacity', 'batchRule.capacity', { min: 1, max: 500, unit: 'pcs' });
      if (b.policy === 'minWait') html += num('Minimum load', 'batchRule.minLoad', { min: 1, max: b.capacity, unit: 'pcs' }) + num('Max wait', 'batchRule.maxWaitMin', { min: 0, unit: 'min', title: 'Launch once the oldest part has waited this long and the minimum load is met' });
      if (b.policy === 'schedule') html += `<label class="f"><span>Cure times</span><input type="text" data-act="schedule" value="${esc(b.schedule.join(', '))}" placeholder="06:00, 14:00, 22:00"></label>`;
      html += `<div class="sub" style="margin:6px 0 2px">Cycle phases</div>`;
      for (const [k, l] of [['loadMin', 'Load + vacuum check'], ['rampMin', 'Heat-up / pressurize'], ['dwellMin', 'Dwell (cure)'], ['coolMin', 'Cool-down'], ['unloadMin', 'Unload']]) {
        html += num(l, `batchRule.cycle.${k}`, { min: 0, step: 5, unit: 'min' });
      }
      html += num('Operators to load / unload', 'batchRule.loadStaff', { min: 0, max: 10 });
      if (op.size) {
        html += `<div class="sub" style="margin:6px 0 2px">Vessel size</div>` +
          num('Inner diameter', 'size.diameter', { min: 0.6, max: 8, step: 0.1, unit: 'm' }) +
          num('Working length', 'size.length', { min: 1, max: 30, step: 0.5, unit: 'm' }) +
          `<button data-act="suggest">Suggest capacity for this size (${suggestCapacity(op.size)})</button>`;
      }
    }
    html += `</details>`;

    // Inputs
    html += `<details open><summary>Inputs</summary>`;
    if (!op.inputs.length) {
      html += `<p class="sub">Raw-material source (no inputs).</p>` +
        sel('Release', 'release.mode', [['unlimited', 'As fast as it can take'], ['interval', 'One every…']]) +
        (op.release.mode === 'interval' ? num('Release every', 'release.every', { min: 1, unit: 's', title: `Takt is ${takt.toFixed(0)} s` }) : '');
    } else {
      html += `<table class="mini"><thead><tr><th>From</th><th title="Parts needed per unit (kit)">Qty</th><th title="Buffer: max parts waiting in this queue">Buffer</th><th></th></tr></thead><tbody>` +
        op.inputs.map((inp, i) => `<tr><td><select data-in="from" data-i="${i}">${opOpts(inp.from)}</select></td>
          <td><input type="number" min="1" max="50" data-in="qty" data-i="${i}" value="${inp.qty}" ${op.inputMode === 'any' || isBatch ? 'disabled' : ''}></td>
          <td><input type="number" min="0" max="500" data-in="cap" data-i="${i}" value="${inp.cap}" title="0 = room for one transfer batch"></td>
          <td><button data-in-act="rm" data-i="${i}">✕</button></td></tr>`).join('') + `</tbody></table>`;
      if (!isBatch && op.inputs.length > 1) html += sel('Combine inputs', 'inputMode', [['kit', 'Kit: assemble qty from each'], ['any', 'Merge streams (first in, first out)']]);
    }
    html += `<div class="row" style="margin-top:4px"><select data-in-act="add" style="width:auto"><option value="">+ Add input from…</option>${opOpts('', null)}</select></div></details>`;

    // Outputs
    const totalShare = op.outputs.reduce((a, o) => a + o.share, 0) || 1;
    html += `<details open><summary>Outputs</summary>`;
    html += op.outputs.length
      ? `<table class="mini"><thead><tr><th>To</th><th title="Relative share of parts">Share</th><th></th><th></th></tr></thead><tbody>` +
        op.outputs.map((o, i) => `<tr><td><select data-out="to" data-i="${i}">${opOpts(o.to)}</select></td>
          <td><input type="number" min="0" max="1000" data-out="share" data-i="${i}" value="${o.share}"></td>
          <td class="sub">${((o.share / totalShare) * 100).toFixed(0)}%</td>
          <td><button data-out-act="rm" data-i="${i}">✕</button></td></tr>`).join('') + `</tbody></table>`
      : `<p class="sub">Ships (end of line).</p>`;
    html += `<div class="row" style="margin-top:4px"><select data-out-act="add" style="width:auto"><option value="">+ Add output to…</option>${opOpts('', null)}</select></div>`;
    html += num('Scrap', 'scrapPct', { min: 0, max: 100, step: 0.5, unit: '%' });
    html += num('Rework', 'reworkPct', { min: 0, max: 100, step: 0.5, unit: '%' });
    if (op.reworkPct > 0) html += `<label class="f"><span>Rework back to</span><select data-p="reworkTo">${opOpts(op.reworkTo, '— choose —')}<option value="${esc(op.id)}" ${op.reworkTo === op.id ? 'selected' : ''}>${esc(op.name)} (itself)</option></select></label>`;
    html += `</details>`;

    html += `<details><summary>Reliability</summary>
      ${num('Mean time between failures', 'mtbf', { min: 0, scale: 60, unit: 'min' })}
      ${num('Mean time to repair', 'mttr', { min: 0, scale: 60, unit: 'min' })}
      <p class="sub">Used when Breakdowns is on in the line settings.</p></details>`;

    html += `<details ${op.startsOutLife || op.outLife?.limitHours ? 'open' : ''}><summary>Out-life (prepreg)</summary>
      ${chk('Out-time starts here', 'startsOutLife')}
      ${isBatch ? num('Limit before cure', 'outLife.limitHours', { min: 0, step: 0.5, unit: 'h', title: '0 = not tracked. Checked when a part is loaded.' }) + sel('If exceeded', 'outLife.action', [['flag', 'Flag (count, keep)'], ['scrap', 'Scrap']]) : '<p class="sub">The limit is checked at the cure (autoclave / oven).</p>'}
    </details>`;

    const lay = op.layout || {};
    html += `<details><summary>Layout</summary>
      <label class="f"><span>X</span><span class="fi"><input type="number" step="0.25" data-lay="x" value="${lay.x ?? ''}"><em>m</em></span></label>
      <label class="f"><span>Z</span><span class="fi"><input type="number" step="0.25" data-lay="z" value="${lay.z ?? ''}"><em>m</em></span></label>
      <label class="f"><span>Rotation</span><span class="fi"><input type="number" step="90" data-lay="rot" value="${lay.rot != null ? Math.round(lay.rot * 180 / Math.PI) : 0}"><em>°</em></span></label>
    </details>`;

    html += `<p class="sub" id="selStats"></p>
      <div class="row"><button data-act="rotate">Rotate 90°</button><button data-act="dup">Duplicate</button><button data-act="del">Delete</button></div>`;
    box.innerHTML = html;
    bind(op, scn);
  }

  function bind(op, scn) {
    const edit = (fn) => h.onEdit(op.id, fn);
    box.querySelectorAll('[data-p]').forEach((inp) => inp.addEventListener('change', () => {
      const p = inp.dataset.p;
      let v;
      if (inp.type === 'checkbox') v = inp.checked;
      else if (inp.type === 'number') v = (+inp.value || 0) * (+inp.dataset.scale || 1);
      else v = inp.value;
      edit((o) => setPath(o, p, v));
    }));
    box.querySelector('[data-act="rename"]')?.addEventListener('change', (e) => h.onRename(op.id, e.target.value.trim()));
    box.querySelector('[data-act="equipment"]')?.addEventListener('change', (e) => h.onEquipment(op.id, e.target.value));
    box.querySelector('[data-act="schedule"]')?.addEventListener('change', (e) => {
      const times = e.target.value.split(/[,\s]+/).filter((x) => /^\d{1,2}:\d{2}$/.test(x));
      edit((o) => { o.batchRule.schedule = times; });
    });
    box.querySelector('[data-act="suggest"]')?.addEventListener('click', () => edit((o) => { o.batchRule.capacity = suggestCapacity(o.size); }));
    box.querySelector('[data-act="rotate"]')?.addEventListener('click', () => h.onRotate());
    box.querySelector('[data-act="dup"]')?.addEventListener('click', () => h.onAction('dup'));
    box.querySelector('[data-act="del"]')?.addEventListener('click', () => h.onAction('del'));
    // Elements
    box.querySelectorAll('[data-e]').forEach((inp) => inp.addEventListener('change', () => {
      const id = inp.closest('tr').dataset.el;
      const k = inp.dataset.e;
      const v = inp.type === 'number' ? Math.max(0, +inp.value || 0) : inp.value;
      h.onScenario((s) => { const e = s.elements.find((x) => x.id === id); if (e) e[k] = v; });
    }));
    box.querySelectorAll('button[data-el-act]').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      const a = b.dataset.elAct;
      if (a === 'rm') edit((o) => { o.elements.splice(i, 1); });
      else if (a === 'up' && i > 0) edit((o) => { [o.elements[i - 1], o.elements[i]] = [o.elements[i], o.elements[i - 1]]; });
      else if (a === 'new') h.onScenario((s) => {
        let n = s.elements.length + 1, id;
        do id = `el${n++}`; while (s.elements.some((e) => e.id === id));
        s.elements.push({ id, name: 'New element', manual: 10, machine: 0 });
        s.operations.find((o) => o.id === op.id).elements.push(id);
      });
    }));
    box.querySelector('select[data-el-act="lib"]')?.addEventListener('change', (e) => { const id = e.target.value; if (id) edit((o) => { o.elements.push(id); }); });
    // Inputs / outputs
    box.querySelectorAll('[data-in]').forEach((inp) => inp.addEventListener('change', () => {
      const i = +inp.dataset.i, k = inp.dataset.in;
      if (k === 'from') h.onReroute(op.id, 'in', i, inp.value);
      else edit((o) => { o.inputs[i][k] = Math.max(k === 'qty' ? 1 : 0, Math.round(+inp.value || 0)); });
    }));
    box.querySelectorAll('[data-out]').forEach((inp) => inp.addEventListener('change', () => {
      const i = +inp.dataset.i, k = inp.dataset.out;
      if (k === 'to') h.onReroute(op.id, 'out', i, inp.value);
      else edit((o) => { o.outputs[i].share = Math.max(0, +inp.value || 0); });
    }));
    box.querySelectorAll('button[data-in-act="rm"]').forEach((b) => b.addEventListener('click', () => h.onDisconnect(op.inputs[+b.dataset.i].from, op.id)));
    box.querySelectorAll('button[data-out-act="rm"]').forEach((b) => b.addEventListener('click', () => h.onDisconnect(op.id, op.outputs[+b.dataset.i].to)));
    box.querySelector('select[data-in-act="add"]')?.addEventListener('change', (e) => { if (e.target.value) h.onConnect(e.target.value, op.id); });
    box.querySelector('select[data-out-act="add"]')?.addEventListener('change', (e) => { if (e.target.value) h.onConnect(op.id, e.target.value); });
    box.querySelectorAll('[data-lay]').forEach((inp) => inp.addEventListener('change', () => {
      const k = inp.dataset.lay;
      const v = +inp.value || 0;
      edit((o) => { o.layout = { x: 0, z: 0, rot: 0, ...(o.layout || {}), [k]: k === 'rot' ? (v * Math.PI) / 180 : v }; });
    }));
  }

  function showProp(target) {
    box.innerHTML = `<div class="insp-head"><b>${esc(PROP_BUILDERS[target.prop.type]?.label || target.prop.type)}</b> <span class="sub">floor model (not simulated)</span></div>
      <div class="row" style="margin-top:6px"><button data-act="rotate">Rotate 90°</button><button data-act="delprop">Delete</button></div>`;
    box.querySelector('[data-act="rotate"]').onclick = () => h.onRotate();
    box.querySelector('[data-act="delprop"]').onclick = () => h.onDeleteProp(target.id);
  }
  function showPallet(target) {
    box.innerHTML = `<div class="insp-head"><b>${target.id.startsWith('raw') ? 'Raw material' : 'Finished goods'}</b> <span class="sub">for ${esc(target.node?.label)}</span></div>
      <div class="row" style="margin-top:6px"><button data-act="rotate">Rotate 90°</button></div>`;
    box.querySelector('[data-act="rotate"]').onclick = () => h.onRotate();
  }

  function stats(text) { const el = box.querySelector('#selStats'); if (el) el.textContent = text; }

  return { show, stats, get current() { return current; } };
}

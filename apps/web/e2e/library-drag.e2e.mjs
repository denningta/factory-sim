#!/usr/bin/env node
// HF-1 e2e: a real mouse drag (not synthetic DOM events) from the library onto the 3D view places
// one item per base type. Run: node apps/web/e2e/library-drag.e2e.mjs  (not yet part of `pnpm check`;
// the repo has no Playwright runner, so it uses playwright-core like scripts/screenshot.mjs).
// Env: BROWSER=chromium|firefox (default chromium), CHROMIUM_PATH.
import { spawn } from 'node:child_process';
import process from 'node:process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-01-01T00:00:00.000Z';
const user = { id: ID, email: 'a@example.com', role: 'admin', disabled: false, createdAt: NOW };
const doc = JSON.parse(readFileSync(join(ROOT, 'docs/reference-model/model.json'), 'utf8'));
const TYPE_IDS = [
  'base-workstation',
  'base-buffer',
  'base-conveyor',
  'base-source',
  'base-sink',
  'base-autoclave',
];
const TYPES = [
  'Workstation',
  'Buffer / rack',
  'Conveyor',
  'Source (material release)',
  'Sink (shipping)',
  'Autoclave (ASC)',
];

const port = await new Promise((ok) => {
  const s = createServer().listen(0, () => {
    const { port: p } = s.address();
    s.close(() => ok(p));
  });
});
const vite = spawn(
  'pnpm',
  ['--filter', '@factory-sim/web', 'exec', 'vite', '--port', String(port), '--strictPort'],
  {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
    detached: true,
  },
);
const stop = () => {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
};
process.on('exit', stop);
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('vite did not start')), 60_000);
  vite.stdout.on('data', (b) => String(b).includes('Local:') && (clearTimeout(t), ok()));
});

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) return undefined;
  for (const d of readdirSync(cache).sort().reverse())
    for (const p of [
      'chrome-linux/chrome',
      'chrome-linux64/chrome',
      'chrome-headless-shell-linux64/chrome-headless-shell',
    ])
      if (existsSync(join(cache, d, p))) return join(cache, d, p);
}

const reply = (route, body, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: body === null ? '' : JSON.stringify(body),
  });
let failures = 0;
let saved = doc; // the autosave PATCH carries the whole document
const fail = (msg) => {
  console.log(`✗ ${msg}`);
  failures += 1;
};
const browser =
  process.env.BROWSER === 'firefox'
    ? await firefox.launch()
    : await chromium.launch({
        executablePath: chromiumPath(),
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route(
    (u) => u.pathname.startsWith('/api/'),
    (route) => {
      const p = new URL(route.request().url()).pathname;
      const summary = { id: ID, name: 'Reference line', updatedAt: NOW, revision: 1 };
      if (p === '/api/auth/setup') return reply(route, { needsSetup: false });
      if (p === '/api/auth/session') return reply(route, { user });
      if (p === '/api/equipment-types') return reply(route, { types: [] });
      if (p === '/api/projects') return reply(route, { projects: [summary] });
      if (p === `/api/projects/${ID}` && route.request().method() === 'PATCH') {
        saved = route.request().postDataJSON().document ?? saved;
        return reply(route, summary);
      }
      if (p === `/api/projects/${ID}`) return reply(route, { ...summary, document: doc });
      return reply(route, null, 204);
    },
  );
  await page.goto(`http://localhost:${port}/#/p/${ID}`);
  await page.waitForLoadState('networkidle');
  const canvas = page.locator('canvas').first();
  await canvas.waitFor();
  await page.waitForTimeout(1500);
  // Page-pixel drop points on the empty part of the floor in the default iso view.
  const spots = [
    [620, 600],
    [700, 650],
    [560, 640],
    [760, 580],
    [660, 700],
    [600, 560],
  ];
  const landed = [];
  for (const [i, name] of TYPES.entries()) {
    const before = saved.equipment.length;
    const item = page.locator(
      `section[aria-label="Equipment library"] li[aria-label="${name}"] button`,
    );
    const b = await item.boundingBox();
    const [x, y] = spots[i];
    await page.mouse.move(b.x + 40, b.y + 30);
    await page.mouse.down();
    await page.mouse.move(b.x + 80, b.y + 40, { steps: 5 });
    await page.mouse.move(x, y, { steps: 15 });
    await page.mouse.up();
    // Autosave is debounced; wait for the PATCH that carries the new item.
    const deadline = Date.now() + 8000;
    while (saved.equipment.length === before && Date.now() < deadline)
      await page.waitForTimeout(100);
    await page.waitForTimeout(1500); // a second, unwanted item would be saved by now
    const added = saved.equipment.length - before;
    const item2 = saved.equipment.at(-1);
    if (added !== 1) fail(`drag ${name}: expected exactly 1 new item, got ${added}`);
    else if (item2.typeId !== TYPE_IDS[i]) fail(`drag ${name}: placed ${item2.typeId}`);
    else {
      landed.push({ name, x, y, at: item2.position });
      console.log(`✓ drag ${name} placed one item at (${item2.position.x}, ${item2.position.y}) m`);
    }
  }
  // "Near the drop point": fit pixel → floor (affine, from the first three drops) and require every
  // item within 3 m of its prediction. A drop at the wrong place (e.g. the origin) misses by far more.
  if (landed.length === TYPES.length) {
    const [p0, p1, p2] = landed;
    const det = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
    const solve = (f) => {
      const du1 = f(p1) - f(p0);
      const du2 = f(p2) - f(p0);
      const a = (du1 * (p2.y - p0.y) - du2 * (p1.y - p0.y)) / det;
      const c = (du2 * (p1.x - p0.x) - du1 * (p2.x - p0.x)) / det;
      return (q) => f(p0) + a * (q.x - p0.x) + c * (q.y - p0.y);
    };
    const fx = solve((q) => q.at.x);
    const fy = solve((q) => q.at.y);
    for (const q of landed) {
      const err = Math.hypot(fx(q) - q.at.x, fy(q) - q.at.y);
      console.log(
        `${err <= 3 ? '✓' : '✗'} ${q.name} lands ${err.toFixed(2)} m from the drop point's fit`,
      );
      if (err > 3) failures += 1;
    }
  }
} finally {
  await browser.close();
  stop();
}
process.exit(failures ? 1 : 0);

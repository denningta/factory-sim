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
      if (p === `/api/projects/${ID}`)
        return route.request().method() === 'GET'
          ? reply(route, { ...summary, document: doc })
          : reply(route, summary);
      return reply(route, null, 204);
    },
  );
  await page.goto(`http://localhost:${port}/#/p/${ID}`);
  await page.waitForLoadState('networkidle');
  const canvas = page.locator('canvas').first();
  await canvas.waitFor();
  await page.waitForTimeout(1500);
  const box = await canvas.boundingBox();
  // Floor points (page px) in the default iso view, all on the empty part of the floor.
  const spots = [
    [620, 600],
    [700, 650],
    [560, 640],
    [760, 580],
    [660, 700],
    [600, 560],
  ];
  for (const [i, name] of TYPES.entries()) {
    const item = page.locator(
      `section[aria-label="Equipment library"] li[aria-label="${name}"] button`,
    );
    const b = await item.boundingBox();
    const [x, y] = spots[i];
    await page.mouse.move(b.x + 40, b.y + 30);
    await page.mouse.down();
    await page.mouse.move(b.x + 80, b.y + 40, { steps: 5 });
    await page.mouse.move(Math.max(box.x + 5, x), y, { steps: 15 });
    await page.mouse.up();
    const selected = page.locator('text=/^Selected: /');
    const ok = await selected
      .filter({ hasText: /Selected: (?!none)/ })
      .waitFor({ timeout: 3000 })
      .then(
        () => true,
        () => false,
      );
    const text = await selected.innerText();
    console.log(`${ok ? '✓' : '✗'} drag ${name} → ${text}`);
    if (!ok) failures += 1;
    await page.keyboard.press('Escape');
    await page.mouse.click(box.x + 20, box.y + 20); // clear selection on empty canvas
    await page.waitForTimeout(200);
  }
} finally {
  await browser.close();
  stop();
}
process.exit(failures ? 1 : 0);

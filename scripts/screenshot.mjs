#!/usr/bin/env node
// Shared UI screenshot tool (lead-owned). Every UI story uses this instead of a home-made harness.
//
//   node scripts/screenshot.mjs docs/screenshots/<ID>/shots.json
//
// It starts the web dev server, answers every /api call in the browser with a signed-in admin and
// one project (the reference model by default), captures each shot at exactly 1280×800 in dark and
// light, writes docs/screenshots/<ID>/<name>-<theme>.png and always stops the dev server.
//
// shots.json:
// {
//   "project": "docs/reference-model/model.json",   // optional; a schemaVersion-current document
//   "shots": [
//     { "name": "results", "screen": "results",      // layout | products | simulate | results | projects | signin
//                                                     (Account: screen "projects" + { "click": "text=Account" })
//       "themes": ["dark", "light"],                  // optional, default both
//       "actions": [                                   // optional, run in order before the capture
//         { "click": "text=Run to end" },              // any Playwright selector
//         { "fill": ["#seed", "42"] }, { "press": "Escape" },
//         { "waitFor": "role=timer" }, { "wait": 1500 }, { "eval": "window.scrollTo(0, 0)" }
//       ] }
//   ]
// }
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORT = { width: 1280, height: 800 };
const THEME_KEY = 'factory-sim.theme'; // apps/web/src/ui/themeStore.ts
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-01-01T00:00:00.000Z';
const ADMIN = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'admin@example.com',
  role: 'admin',
  disabled: false,
  createdAt: NOW,
};
const OTHER = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'engineer@example.com',
  role: 'user',
  disabled: false,
  createdAt: NOW,
};

const specPath = process.argv[2];
if (!specPath) {
  console.error('usage: node scripts/screenshot.mjs docs/screenshots/<ID>/shots.json');
  process.exit(2);
}
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));
const outDir = dirname(resolve(specPath));
const document = JSON.parse(
  readFileSync(resolve(ROOT, spec.project ?? 'docs/reference-model/model.json'), 'utf8'),
);
let revision = 1;
const summary = () => ({
  id: PROJECT_ID,
  name: spec.projectName ?? 'Reference line',
  updatedAt: NOW,
  revision,
});

function freePort() {
  return new Promise((ok) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
}

function browserPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) return undefined;
  for (const d of readdirSync(cache).sort().reverse()) {
    for (const p of [
      join(cache, d, 'chrome-linux', 'chrome'),
      join(cache, d, 'chrome-linux64', 'chrome'),
      join(cache, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
    ])
      if (existsSync(p)) return p;
  }
  return undefined;
}

async function startVite(port) {
  const vite = spawn(
    'pnpm',
    ['--filter', '@factory-sim/web', 'exec', 'vite', '--port', String(port), '--strictPort'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true, // own process group, so stop() takes esbuild down too
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
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('vite did not start within 60 s')), 60_000);
    vite.stdout.on('data', (b) => String(b).includes('Local:') && (clearTimeout(t), ok()));
    vite.on('exit', (c) => fail(new Error(`vite exited (${c})`)));
  });
  return stop;
}

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: body === null ? '' : JSON.stringify(body),
  });
}

async function mockApi(page, signedIn) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const m = req.method();
      if (path === '/api/auth/setup') return json(route, { needsSetup: false });
      if (path === '/api/auth/session')
        return signedIn
          ? json(route, { user: ADMIN })
          : json(route, { error: { code: 'unauthorized', message: 'Sign in' } }, 401);
      if (path === '/api/auth/login') return json(route, { user: ADMIN });
      if (path === '/api/users') return json(route, { users: [ADMIN, OTHER] });
      if (path === '/api/equipment-types') return json(route, { types: [] });
      if (path === '/api/projects' && m === 'GET') return json(route, { projects: [summary()] });
      if (path === `/api/projects/${PROJECT_ID}` && m === 'GET')
        return json(route, { ...summary(), document });
      if (path === `/api/projects/${PROJECT_ID}` && m === 'PATCH') {
        revision += 1;
        return json(route, summary());
      }
      if (m === 'GET') console.warn(`  unmocked GET ${path}`);
      return json(route, null, 204);
    },
  );
}

const hashFor = (screen) =>
  ({ projects: '', signin: '', layout: `#/p/${PROJECT_ID}` })[screen] ??
  `#/p/${PROJECT_ID}/${screen}`;

const port = await freePort();
const stop = await startVite(port);
const browser = await chromium.launch({
  executablePath: browserPath(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let failed = 0;
try {
  mkdirSync(outDir, { recursive: true });
  for (const shot of spec.shots) {
    for (const theme of shot.themes ?? ['dark', 'light']) {
      const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
      await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [THEME_KEY, theme]);
      await mockApi(page, shot.screen !== 'signin');
      await page.goto(`http://localhost:${port}/${hashFor(shot.screen)}`);
      await page.waitForLoadState('networkidle');
      for (const a of shot.actions ?? []) {
        if (a.click) await page.click(a.click);
        else if (a.fill) await page.fill(a.fill[0], a.fill[1]);
        else if (a.press) await page.keyboard.press(a.press);
        else if (a.waitFor) await page.waitForSelector(a.waitFor);
        else if (a.wait) await page.waitForTimeout(a.wait);
        else if (a.eval) await page.evaluate(a.eval);
      }
      await page.waitForTimeout(shot.settle ?? 800); // let the 3D canvas draw a few frames
      const file = join(outDir, `${shot.name}-${theme}.png`);
      await page.screenshot({ path: file });
      console.log(
        `${errors.length ? '!' : '✓'} ${file.replace(ROOT + '/', '')}${errors.length ? `  console errors:\n    ${errors.join('\n    ')}` : ''}`,
      );
      if (errors.length) failed += 1;
      await page.close();
    }
  }
} finally {
  await browser.close();
  stop();
}
process.exit(failed ? 1 : 0);

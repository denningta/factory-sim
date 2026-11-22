/* global console, process, setTimeout, fetch, WebSocket */
// Runs the ?auto benchmark in a dedicated Chromium (background throttling off, so rAF isn't
// capped to 1 Hz when the window is occluded) and prints a markdown table.
// Usage: node scripts/measure.mjs [url] [--headless]   (needs `pnpm dev` running)
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/?auto=1';
const headless = args.includes('--headless');
const port = 9333;
const chrome = spawn(
  process.env.CHROME ?? 'chromium',
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pl5-'))}`,
    '--no-first-run',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-background-timer-throttling',
    '--window-size=1280,800',
    ...(headless ? ['--headless=new'] : []),
    'about:blank',
  ],
  { stdio: 'ignore' },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((t) => t.type === 'page');
    } catch {
      /* not up yet */
    }
  }
  if (!target) throw new Error('could not reach chromium');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    pending.get(d.id)?.(d);
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      pending.set(++id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send('Page.navigate', { url });
  let out;
  for (let i = 0; i < 300; i++) {
    await sleep(1000);
    const r = await send('Runtime.evaluate', {
      expression: 'JSON.stringify(window.__bench ?? null)',
    });
    const v = JSON.parse(r.result?.result?.value ?? 'null');
    if (v?.done) {
      out = v;
      break;
    }
  }
  if (!out) throw new Error('benchmark did not finish');
  console.log(`GPU: ${out.gpu}`);
  console.log(
    '| config | mean fps | median fps | p95 ms | max ms | JS update ms | draw calls | triangles | warm-up ms |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of out.results)
    console.log(
      `| ${r.label} | ${r.fps?.toFixed(1) ?? 'n/a'} | ${r.medianFps?.toFixed(1) ?? 'n/a'} | ${r.p95ms.toFixed(1)} | ${r.maxMs.toFixed(1)} | ${r.updateMs?.toFixed(2)} | ${r.drawCalls} | ${r.triangles} | ${Math.round(r.warmupMs ?? 0)} |`,
    );
} finally {
  chrome.kill();
}

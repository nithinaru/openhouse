// Renders index.html frame-by-frame with headless Chrome (DevTools protocol, no deps).
// usage: node capture.mjs <outDir> [fps=30] [totalMs=13000] [onlyTimesCsv]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.argv[2] || path.join(here, 'frames'));
const fps = +(process.argv[3] || 30);
const total = +(process.argv[4] || 13000);
const only = process.argv[5] ? process.argv[5].split(',').map(Number) : null;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
mkdirSync(outDir, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--allow-file-access-from-files', `--user-data-dir=${path.join(outDir, '.profile')}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  if (!target) await sleep(200);
}
if (!target) { chrome.kill(); throw new Error('chrome did not start'); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
const url = pathToFileURL(path.join(here, 'index.html')).href + '?t=0' + (process.env.QUERY ? '&' + process.env.QUERY : '');
await send('Page.navigate', { url });
await sleep(2500); // images + fonts
await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });

const times = only || Array.from({ length: Math.round(total / 1000 * fps) }, (_, i) => Math.round(i * 1000 / fps));
let n = 0;
for (const t of times) {
  await send('Runtime.evaluate', { expression: `render(${t})` });
  await send('Runtime.evaluate', { expression: 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))', awaitPromise: true });
  const { result } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
  const name = only ? `t${String(t).padStart(5, '0')}.jpg` : `f${String(n).padStart(4, '0')}.jpg`;
  writeFileSync(path.join(outDir, name), Buffer.from(result.data, 'base64'));
  n++;
}
ws.close(); chrome.kill();
console.log(`wrote ${n} frames to ${outDir}`);

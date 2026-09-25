// Gemeinsame Hilfen: Headless Chrome über das DevTools-Protokoll steuern.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CANDIDATES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

export function chromePath() {
  const p = CANDIDATES.find(c => existsSync(c));
  if (!p) throw new Error('Kein Chrome gefunden. Pfad per CHROME=/pfad/zu/chrome setzen.');
  return p;
}

export function pageURL(params = '') {
  return pathToFileURL(path.join(ROOT, 'index.html')).href + (params ? `?${params}` : '');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Öffnet url in einem frischen Headless-Chrome (eigenes Profil, damit Läufe parallel gehen)
// und ruft fn(page) auf. page.eval(js), page.waitFor(js), page.shot(opts), page.errors[].
export async function withPage(url, fn, { width = 1600, height = 1000, scale = 1 } = {}) {
  const profile = mkdtempSync(path.join(tmpdir(), 'cf-chrome-'));
  const proc = spawn(chromePath(), [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let ws;
  try {
    const wsUrl = await new Promise((res, rej) => {
      let buf = '';
      const t = setTimeout(() => rej(new Error('Chrome startet nicht (15 s)')), 15000);
      proc.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } });
      proc.on('exit', code => { clearTimeout(t); rej(new Error(`Chrome beendet (${code})`)); });
    });
    ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools-Verbindung fehlgeschlagen')); });
    let seq = 0;
    const pending = new Map(), listeners = [];
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else listeners.forEach(l => l(msg));
    };
    const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const page = { errors: [] };
    page.send = (m, p) => send(m, p, sessionId);
    listeners.push(msg => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        page.errors.push(`${d.exception?.description?.split('\n')[0] || d.text}${d.url ? ` (${d.url.split('/').slice(-2).join('/').split('?')[0]}:${d.lineNumber + 1})` : ''}`);
      }
    });
    await page.send('Runtime.enable');
    await page.send('Page.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    page.eval = async expression => {
      const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    page.waitFor = async (expression, timeout = 20000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        try { if (await page.eval(expression)) return true; } catch {}
        await sleep(100);
      }
      return false;
    };
    page.resize = (w, h) => page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: false });
    // shot({ jpeg: 60 }) = JPEG mit Qualität 60 statt PNG; clip = Ausschnitt { x, y, width, height } in CSS-Pixeln
    page.shot = async ({ jpeg = 0, clip = null } = {}) => Buffer.from((await page.send('Page.captureScreenshot', { format: jpeg ? 'jpeg' : 'png', ...(jpeg ? { quality: jpeg } : {}), ...(clip ? { clip: { ...clip, scale: 1 }, captureBeyondViewport: true } : {}) })).data, 'base64');
    await page.send('Page.navigate', { url });
    return await fn(page);
  } finally {
    try { ws?.close(); } catch {}
    proc.kill('SIGKILL');
    await sleep(50);
    rmSync(profile, { recursive: true, force: true });
  }
}

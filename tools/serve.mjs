#!/usr/bin/env node
// Lokaler Server mit Live-Reload: jede Änderung an components/, factory/ oder media/ lädt die Seite neu.
// Außerdem gehen Anfragen aus der Eingabezeile („Bauen“) an Claude Code auf diesem Rechner.
//   node tools/serve.mjs      → http://localhost:4173
//   CF_MODEL=opus node tools/serve.mjs   anderes Modell für die Anfragen
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './_chrome.mjs';
import { listMedia } from './media.mjs';
import { createClaudeJob, claudeAvailable } from './claude-bridge.mjs';
import { renderSystemJS, validSystem } from './system-file.mjs';
import { createHistory } from './history.mjs';
import { execFile } from 'node:child_process';

const PORT = +process.env.PORT || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4',
};
const RELOAD = `<script>new EventSource('/__reload').onmessage = () => { if (!window.__cfHold) location.reload(); };</script>`;
const clients = new Set();
let job = null, pendingPing = false;
// Die laufende Anfrage mit allen bisherigen Ereignissen: Eine neu geladene Seite hängt sich über /api/job wieder an
let jobInfo = null;
const history = createHistory(ROOT, { busy: () => !!job });
const muted = new Map(); // Dateien, die die Seite selbst schreibt: kein Neuladen auslösen
const readBody = req => new Promise(res => { let b = ''; req.on('data', d => { b += d; if (b.length > 500000) req.destroy(); }); req.on('end', () => { try { res(JSON.parse(b)); } catch { res(null); } }); });
const sendJSON = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const validId = id => typeof id === 'string' && /^[a-z0-9-]+$/.test(id) && fs.existsSync(path.join(ROOT, 'components', `${id}.js`));

// Feinschliff aus dem Bearbeiten-Modus schreiben (ohne Neuladen – die Seite zeigt ihn schon)
function writeTweaks(id, tweaks) {
  const name = `${id}.tweaks.js`, file = path.join(ROOT, 'components', name);
  muted.set(name, Date.now() + 1500);
  if (!tweaks || !Object.keys(tweaks).length) { fs.rmSync(file, { force: true }); return; }
  fs.writeFileSync(file, `// Feinschliff aus dem Bearbeiten-Modus – wird beim Rendern angewendet und von der Prüfung mitgemessen.
// el: Inline-Stile je Fläche (Schlüssel = data-area, ^name = Container dieser Fläche) · text: Textstil/-inhalt (Fläche>Index)
// height: Kartenhöhe · locks: gesperrte Flächen (R9) · notes: Aufträge an Claude. Claude arbeitet el/text/height in den Code ein.
Factory.tweaks(${JSON.stringify(id)}, ${JSON.stringify(tweaks, null, 2)});
`);
}

// Leitsätze (feedback/leitsaetze.js): Claude leitet sie ab, die Fabrik ändert nur ihren Status
const LS_FILE = path.join(ROOT, 'feedback', 'leitsaetze.js');
const LS_HEAD = `// Leitsätze: was Claude aus den Rückmeldungen des Teams ableitet (Entscheidungen zu Varianten, Ausnahmen, Feinschliff).
// Die Ansicht „Regeln“ → Gelernt zeigt sie; dort werden sie bestätigt, verworfen oder zur Regel gemacht.
// status: vorschlag = gilt noch nicht · bestaetigt = gilt wie eine Soll-Regel · regel = steht jetzt im Regelwerk (regel: <regelwerk>:<id>) · verworfen = nicht wieder vorschlagen
// system: null = alle Regelwerke, sonst die id · belege: <komponente>/<layout> (Entscheidung in praeferenzen.js),
//   ausnahme:<komponente>/<layout>/<prüfung>, feinschliff:<komponente>[/<layout>] · warum: woraus der Leitsatz folgt, ein Halbsatz.
// Nach „window.CF_LEITSAETZE =“ steht gültiges JSON.
`;
function readLeitsaetze() {
  if (!fs.existsSync(LS_FILE)) return [];
  const m = fs.readFileSync(LS_FILE, 'utf8').match(/window\.CF_LEITSAETZE\s*=\s*(\[[\s\S]*\]);?\s*$/);
  if (!m) throw new Error('feedback/leitsaetze.js hat kein gültiges Format');
  return JSON.parse(m[1]);
}
const writeLeitsaetze = list => { fs.mkdirSync(path.dirname(LS_FILE), { recursive: true }); fs.writeFileSync(LS_FILE, `${LS_HEAD}window.CF_LEITSAETZE = ${JSON.stringify(list, null, 2)};\n`); };

// Kennzahlen eines Auftrags aus seinen Arbeitsschritten. Sie stehen als Zeile „Wirkung: …“ in der Commit-Nachricht:
// Git ist der Speicher, die Zahlen reisen mit dem Verlauf (auch auf GitHub), und Rückgängig löscht sie nicht.
// pruefungen = Ergebnisse der gezielten Prüfläufe nach dem ersten Schreiben, je „Verstöße:Hinweise“.
function jobMetrics(info, ev, system) {
  let wrote = false, steps = 0, reads = 0, denied = 0;
  const checks = [];
  info.events.forEach((e, i) => {
    if (e.type === 'detail' && e.text === 'abgelehnt') denied++;
    if (e.type !== 'step') return;
    steps++;
    if (/^(file\.read|rules\.read|files\.find|files\.search|shell)\(/.test(e.code)) reads++;
    if (/^component\.(write|edit)\(/.test(e.code)) wrote = true;
    const m = e.code.match(/^rules\.check\((?:"([^"]*)")?\)/);
    if (!m || !wrote || !m[1] || m[1].startsWith('--')) return; // nur Prüfungen einer Komponente, nach dem ersten Schreiben
    const d = info.events[i + 1]?.type === 'detail' ? info.events[i + 1].text : '';
    const v = /^im Raster/.test(d) ? 0 : +((d.match(/^(\d+) Verstöße/) || [])[1] ?? NaN);
    if (Number.isFinite(v)) checks.push(`${v}:${+((d.match(/(\d+) Hinweise/) || [])[1] || 0)}`);
  });
  const kv = { dauer: Math.round((Date.now() - info.started) / 1000), kosten: ev.cost != null ? (+ev.cost).toFixed(2) : '-', schritte: steps, gelesen: reads, abgelehnt: denied, kontext: info.context ? 'ja' : 'nein', pruefungen: checks.join(',') || '-', komponente: ev.id || '-', regelwerk: system, ansicht: info.view };
  return `Wirkung: ${Object.entries(kv).map(([k, v]) => `${k}=${v}`).join(' ')}`;
}
const parseWirkung = body => { const m = (body || '').match(/^Wirkung: (.+)$/m); return m ? Object.fromEntries(m[1].split(' ').map(p => p.split('='))) : null; };

// Text direkt in der Komponentendatei ersetzen – nur wenn er genau einmal als ganzer String oder Elementtext vorkommt
function patchText(id, from, to) {
  if (!from || from.length < 2 || /[`'"\\$<>&\n]/.test(to) || /\n/.test(from)) return { ok: false, reason: 'zeichen' };
  const file = path.join(ROOT, 'components', `${id}.js`);
  const src = fs.readFileSync(file, 'utf8');
  const hits = [];
  for (let i = src.indexOf(from); i >= 0; i = src.indexOf(from, i + 1)) {
    const before = src[i - 1], after = src[i + from.length];
    if (/['"`>]/.test(before) && /['"`<]/.test(after)) hits.push(i);
  }
  if (hits.length !== 1) return { ok: false, reason: hits.length ? 'mehrdeutig' : 'nicht gefunden' };
  fs.writeFileSync(file, src.slice(0, hits[0]) + to + src.slice(hits[0] + from.length));
  return { ok: true };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': ok\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ claude: claudeAvailable(), busy: !!job, history: history.enabled, job: job && jobInfo ? { prompt: jobInfo.prompt, view: jobInfo.view, started: jobInfo.started } : null }));
  }
  // Zeitreise: /@<commit>/… liefert die Fabrik genau so, wie sie in diesem Commit war (für Vorher/Nachher)
  const at = url.pathname.match(/^\/@([0-9a-f]{7,40})(\/.*)?$/);
  if (at) {
    let file = decodeURIComponent(at[2] || '/').replace(/^\//, '');
    if (!file || file.endsWith('/')) file += 'index.html';
    if (file === 'media/_media.js') { res.writeHead(200, { 'Content-Type': TYPES['.js'] }); return res.end(`window.MEDIA = ${JSON.stringify(listMedia())};`); }
    const buf = history.show(at[1], file);
    const ext = path.extname(file).toLowerCase();
    if (!buf) {
      if (/\.tweaks\.js$/.test(file)) { res.writeHead(200, { 'Content-Type': TYPES['.js'] }); return res.end('/* kein Feinschliff */'); }
      res.writeHead(404); return res.end('Nicht in diesem Stand');
    }
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600' });
    return res.end(buf);
  }
  if (url.pathname === '/api/history') {
    try { if (!fs.existsSync(path.join(ROOT, '.git', 'cf-hold'))) history.commitNow(); } catch {}
    return sendJSON(res, 200, { ok: history.enabled, items: history.list(40) });
  }
  // Wirkung: Aufträge, Feinschliff, Rückgängig und Regeländerungen aus dem Verlauf (ohne dabei zu committen)
  if (url.pathname === '/api/wirkung') {
    const items = history.enabled ? history.list(400).map(i => ({ sha: i.short, when: i.when, subject: i.subject, kind: i.kind, undone: i.undone, files: i.files, wirkung: parseWirkung(i.body) })) : [];
    return sendJSON(res, 200, { ok: history.enabled, items });
  }
  if (url.pathname === '/api/undo' && req.method === 'POST') {
    if (job) return sendJSON(res, 409, { ok: false, error: 'Claude arbeitet gerade – danach geht Rückgängig wieder.' });
    const r = history.undo();
    if (r.ok) console.log(`↶ Rückgängig: ${r.subject}`);
    return sendJSON(res, 200, r);
  }
  if (url.pathname === '/api/restore' && req.method === 'POST') {
    if (job) return sendJSON(res, 409, { ok: false, error: 'Claude arbeitet gerade.' });
    readBody(req).then(b => { const r = history.restore(b?.sha); if (r.ok) console.log(`↺ ${r.subject}`); sendJSON(res, 200, r); });
    return;
  }
  if (url.pathname === '/api/job') {
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' });
    if (!job || !jobInfo) { res.write(JSON.stringify({ type: 'error', text: 'Die Anfrage ist schon beendet.' }) + '\n'); return res.end(); }
    for (const ev of jobInfo.events) res.write(JSON.stringify(ev) + '\n');
    jobInfo.subs.add(res);
    req.on('close', () => jobInfo?.subs.delete(res));
    return;
  }
  if (url.pathname === '/api/cancel' && req.method === 'POST') {
    job?.cancel();
    res.writeHead(204); return res.end();
  }
  if (url.pathname === '/api/generate' && req.method === 'POST') {
    if (job) { res.writeHead(409, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Claude arbeitet schon an einer Anfrage.' })); }
    let body = '';
    req.on('data', d => { body += d; if (body.length > 20000) req.destroy(); });
    req.on('end', () => {
      let prompt = '', system = 'fabrik', figma = false, view = 'build', context = process.env.CF_CONTEXT === '1';
      try { const j = JSON.parse(body); prompt = String(j.prompt || '').trim(); if (/^[a-z0-9-]+$/.test(j.system || '')) system = j.system; figma = j.figma === true; if (/^[a-z]+$/.test(j.view || '')) view = j.view; if (typeof j.context === 'boolean') context = j.context; } catch {}
      if (!prompt) { res.writeHead(400); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' });
      const info = jobInfo = { prompt, view, context, started: Date.now(), events: [], subs: new Set() };
      const send = ev => {
        info.events.push(ev);
        const line = JSON.stringify(ev) + '\n';
        for (const r of [res, ...info.subs]) { try { r.write(line); } catch {} }
      };
      console.log(`→ Claude: ${prompt}`);
      job = createClaudeJob(prompt, { root: ROOT, model: process.env.CF_MODEL, system, figma, context, onEvent: send });
      job.done.then(ev => {
        console.log(ev.type === 'done' ? `✓ fertig${ev.id ? ` (${ev.id})` : ''}` : `✕ ${ev.text}`);
        try { if (ev.type === 'done') history.commitNow(`Claude: ${prompt.split('\n')[0].slice(0, 100)}`, { claude: true, body: jobMetrics(info, ev, system), only: Array.isArray(ev.files) ? ev.files : null }); } catch (e) { console.error('Verlauf:', e.message); }
        send(ev); res.end(); info.subs.forEach(r => { try { r.end(); } catch {} }); job = null;
        if (pendingPing) { pendingPing = false; setTimeout(ping, 400); }
      });
    });
    return;
  }
  if (url.pathname === '/api/tweaks' && req.method === 'POST') {
    readBody(req).then(b => {
      if (!b || !validId(b.id) || typeof b.tweaks !== 'object') return sendJSON(res, 400, { ok: false });
      writeTweaks(b.id, b.tweaks);
      history.schedule(typeof b.reason === 'string' && b.reason ? b.reason.slice(0, 100) : `Feinschliff: ${b.id}`);
      sendJSON(res, 200, { ok: true });
    });
    return;
  }
  if (url.pathname === '/api/system' && req.method === 'POST') {
    readBody(req).then(b => {
      const sid = String(b?.id || b?.system?.id || '');
      if (!/^[a-z0-9-]+$/.test(sid) || !fs.existsSync(path.join(ROOT, 'systems', sid, 'system.js'))) return sendJSON(res, 400, { ok: false, error: 'Unbekanntes Regelwerk' });
      if (!validSystem(b.system)) return sendJSON(res, 400, { ok: false, error: 'Ungültiges Regelwerk' });
      fs.writeFileSync(path.join(ROOT, 'systems', sid, 'system.js'), renderSystemJS({ ...b.system, id: sid }));
      console.log(`§ Regeln übernommen (System v${b.system.version})`);
      history.commitNow(`Regeln: ${String(b.message || 'angepasst').slice(0, 90)} (${sid} v${b.system.version})`);
      sendJSON(res, 200, { ok: true });
    });
    return;
  }
  if (url.pathname === '/api/export' && req.method === 'POST') {
    readBody(req).then(b => {
      const kind = String(b?.kind || ''), sys = String(b?.system || 'fabrik'), cid = b?.id ? String(b.id) : null;
      if (!['tokens', 'html', 'figma', 'wc', 'all'].includes(kind) || !/^[a-z0-9-]+$/.test(sys) || (cid && !validId(cid))) return sendJSON(res, 400, { ok: false, error: 'Ungültiger Export' });
      execFile(process.execPath, [path.join(ROOT, 'tools', 'export.mjs'), kind, ...(cid ? [cid] : []), '--system', sys], { cwd: ROOT, timeout: 120000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
        const line = String(stdout || '').trim().split('\n').pop();
        try { const j = JSON.parse(line); console.log(`⇪ Export ${kind}${cid ? ` ${cid}` : ''} (${sys}): ${j.files.length} Dateien`); return sendJSON(res, 200, j); } catch {}
        sendJSON(res, 500, { ok: false, error: err ? err.message : 'Export ohne Ergebnis' });
      });
    });
    return;
  }
  if (url.pathname === '/api/feedback' && req.method === 'POST') {
    readBody(req).then(b => {
      if (!b || !validId(b.c) || typeof b.l !== 'string' || !['behalten', 'verworfen'].includes(b.decision)) return sendJSON(res, 400, { ok: false });
      const file = path.join(ROOT, 'feedback', 'praeferenzen.js');
      let list = [];
      try { const m = fs.readFileSync(file, 'utf8').match(/window\.CF_FEEDBACK = (\[[\s\S]*\]);/); if (m) list = JSON.parse(m[1]); } catch {}
      list.push({ when: new Date().toISOString().slice(0, 10), system: String(b.system || '').slice(0, 20), c: b.c, l: b.l.slice(0, 60), name: String(b.name || '').slice(0, 80), idea: String(b.idea || '').slice(0, 400), variantOf: b.variantOf || null, direction: b.direction || null, decision: b.decision, comment: String(b.comment || '').slice(0, 300) });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `// Präferenzen des Teams: behaltene und verworfene Varianten mit Kommentar. Claude liest das, bevor es neue Varianten baut.\nwindow.CF_FEEDBACK = ${JSON.stringify(list, null, 2)};\n`);
      history.schedule(`Präferenz: ${b.c}/${b.l} ${b.decision}`);
      console.log(`♥ Präferenz: ${b.c}/${b.l} ${b.decision}${b.comment ? ` – ${b.comment}` : ''}`);
      sendJSON(res, 200, { ok: true });
    });
    return;
  }
  if (url.pathname === '/api/leitsatz' && req.method === 'POST') {
    readBody(req).then(b => {
      if (job) return sendJSON(res, 409, { ok: false, error: 'Claude arbeitet gerade – gleich noch einmal.' });
      const NEXT = { confirm: 'bestaetigt', drop: 'verworfen', unconfirm: 'vorschlag', rule: 'regel' };
      if (!b || typeof b.id !== 'string' || !NEXT[b.action]) return sendJSON(res, 400, { ok: false, error: 'Ungültige Anfrage' });
      let list;
      try { list = readLeitsaetze(); } catch (e) { return sendJSON(res, 500, { ok: false, error: e.message }); }
      const x = list.find(l => l.id === b.id);
      if (!x) return sendJSON(res, 404, { ok: false, error: `Leitsatz ${b.id} nicht gefunden` });
      let msg = `Gelernt: ${b.id} ${{ confirm: 'bestätigt', drop: 'verworfen', unconfirm: 'wieder Vorschlag', rule: 'wird Regel' }[b.action]}`;
      if (b.action === 'rule') {
        const sid = String(b.systemId || '');
        if (!/^[a-z0-9-]+$/.test(sid) || !fs.existsSync(path.join(ROOT, 'systems', sid, 'system.js'))) return sendJSON(res, 400, { ok: false, error: 'Unbekanntes Regelwerk' });
        if (!validSystem(b.system) || !/^[A-Za-z]+\d+$/.test(String(b.rule || '')) || !b.system.rules.some(r => r.id === b.rule)) return sendJSON(res, 400, { ok: false, error: 'Ungültiges Regelwerk' });
        fs.writeFileSync(path.join(ROOT, 'systems', sid, 'system.js'), renderSystemJS({ ...b.system, id: sid }));
        x.regel = `${sid}:${b.rule}`;
        msg += ` ${b.rule} (${sid} v${b.system.version})`;
      }
      x.status = NEXT[b.action];
      writeLeitsaetze(list);
      console.log(`✦ ${msg}`);
      history.commitNow(msg);
      sendJSON(res, 200, { ok: true, list });
    });
    return;
  }
  if (url.pathname === '/feedback/leitsaetze.js' && !fs.existsSync(LS_FILE)) {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    return res.end('window.CF_LEITSAETZE = [];');
  }
  if (url.pathname === '/feedback/praeferenzen.js' && !fs.existsSync(path.join(ROOT, 'feedback', 'praeferenzen.js'))) {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    return res.end('window.CF_FEEDBACK = [];');
  }
  if (url.pathname === '/api/text' && req.method === 'POST') {
    readBody(req).then(b => {
      if (!b || !validId(b.id)) return sendJSON(res, 400, { ok: false });
      const r = patchText(b.id, String(b.from || ''), String(b.to || ''));
      if (r.ok) { console.log(`✎ Text in components/${b.id}.js: „${b.from}“ → „${b.to}“`); history.commitNow(`Text: ${b.id} „${b.from}“ → „${b.to}“`); }
      sendJSON(res, 200, r);
    });
    return;
  }
  const tw = url.pathname.match(/^\/components\/([a-z0-9-]+)\.tweaks\.js$/);
  if (tw && !fs.existsSync(path.join(ROOT, 'components', `${tw[1]}.tweaks.js`))) {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    return res.end('/* kein Feinschliff */');
  }
  if (url.pathname === '/media/_media.js') {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    return res.end(`window.MEDIA = ${JSON.stringify(listMedia())};`);
  }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Nicht gefunden'); }
    const ext = path.extname(file).toLowerCase();
    const type = TYPES[ext] || 'application/octet-stream';
    const range = req.headers.range && /^video\//.test(type) ? req.headers.range.match(/bytes=(\d*)-(\d*)/) : null;
    if (range) {
      const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    if (ext === '.html') {
      const html = fs.readFileSync(file, 'utf8').replace('</body>', `${RELOAD}</body>`);
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      return res.end(html);
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  });
});
server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} ist belegt – läuft die Fabrik schon? Sonst: PORT=4174 node tools/serve.mjs`);
  else console.error(e.message);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => console.log(`Component Factory: http://localhost:${PORT}  (Live-Reload an${claudeAvailable() ? ' · Anfragen gehen an Claude Code' : ' · Claude Code nicht gefunden'} · Strg+C beendet)`));

let timer;
// Während Claude arbeitet, nicht neu laden – erst wenn die Anfrage fertig ist.
const ping = () => { history.schedule(null, 3000); if (job) { pendingPing = true; return; } clearTimeout(timer); timer = setTimeout(() => clients.forEach(c => c.write('data: reload\n\n')), 150); };
for (const dir of ['components', 'factory', 'media', 'systems']) fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
for (const dir of ['components', 'factory', 'media']) fs.watch(path.join(ROOT, dir), (_, name) => { if (!name || name.startsWith('.')) return; if ((muted.get(name) || 0) > Date.now()) return; ping(); });
fs.watch(ROOT, (_, name) => { if (name === 'index.html') ping(); });
fs.watch(path.join(ROOT, 'systems'), { recursive: true }, (_, name) => { if (!name || name.includes('fonts') || name.startsWith('.')) return; ping(); });

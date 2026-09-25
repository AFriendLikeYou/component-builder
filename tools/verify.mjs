#!/usr/bin/env node
// Ein Befehl für Claude nach jeder Änderung: prüft die Komponente (samt Zuständen, falls sie welche hat) und macht einen
// verkleinerten Screenshot (JPEG) der Layouts – oder nur der genannten. Eine Runde statt Prüfen, Screenshot, Ansehen einzeln.
//   node tools/verify.mjs music                      alle Layouts
//   node tools/verify.mjs music kompakt zeile        nur diese Layouts im Bild (geprüft wird immer die ganze Komponente)
//   Optionen: --system=<id> --stress --widths --quality=60
// Ausgabe: kurzer Prüfbericht ohne Farbcodes, danach der Pfad des Bildes. Das Bild danach ansehen (Read).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { withPage, pageURL, ROOT } from './_chrome.mjs';

const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
const [id, ...layouts] = args.filter(a => !a.startsWith('-'));
if (!id) { console.error('Aufruf: node tools/verify.mjs <komponente> [layout …]'); process.exit(2); }
const system = opt('system') || 'fabrik';
const quality = +(opt('quality') || 60);

// 1. Prüfen – mit Zuständen, wenn die Komponente welche hat
const src = (() => { try { return readFileSync(path.join(ROOT, 'components', `${id}.js`), 'utf8'); } catch { return ''; } })();
const checkArgs = ['tools/check.mjs', id, '--system', system, ...(/\bstates\s*:/.test(src) ? ['--states'] : []), ...(args.includes('--stress') ? ['--stress'] : []), ...(args.includes('--widths') ? ['--widths'] : [])];
let out = '', failed = false;
try { out = execFileSync(process.execPath, checkArgs, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16e6 }); }
catch (e) { out = (e.stdout || '') + (e.stderr || ''); failed = e.status !== 1; }
const report = out.replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter(l => l.trim() && !/^Component Factory · Prüfung/.test(l)).join('\n');
console.log(report);
if (failed) process.exit(2);

// 2. Screenshot: Layouts-Ansicht, nur die genannten Layouts ausgeschnitten, JPEG
mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
const file = path.join(ROOT, 'shots', `${id}-pruefung.jpg`);
await withPage(pageURL(`view=layouts&c=${encodeURIComponent(id)}&solo&still&media=none&system=${encodeURIComponent(system)}`), async page => {
  const ok = await page.waitFor("document.documentElement.dataset.ready === '1'", 30000);
  if (!ok) throw new Error('Seite nicht fertig geworden');
  const box = await page.eval(`(() => {
    const want = ${JSON.stringify(layouts)};
    const all = [...document.querySelectorAll('.cf-card[data-c=${JSON.stringify(id)}]')];
    // nicht gewünschte Layouts ausblenden, damit die gewünschten nebeneinanderrücken
    for (const c of all) if (want.length && !want.includes(c.dataset.l)) (c.closest('.cf-lay-item') || c).style.display = 'none';
    const items = all.filter(c => !want.length || want.includes(c.dataset.l)).map(c => c.closest('.cf-lay-item') || c);
    if (!items.length) return null;
    const rs = items.map(i => i.getBoundingClientRect());
    const x = Math.min(...rs.map(r => r.left)), y = Math.min(...rs.map(r => r.top)), r = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom));
    return JSON.stringify({ x: Math.max(0, x - 16 + scrollX), y: Math.max(0, y - 16 + scrollY), width: r - x + 32, height: b - y + 32 });
  })()`);
  if (!box) throw new Error(`Keine Layouts von „${id}“ gefunden${layouts.length ? ` (${layouts.join(', ')})` : ''}`);
  writeFileSync(file, await page.shot({ jpeg: quality, clip: JSON.parse(box) }));
}, { width: 1320, height: 1000 });
console.log(`\nBild: ${path.relative(ROOT, file)} – ansehen und optische Fehler beheben (abgeschnittener Text, Gedränge, Leere, Hierarchie).`);

#!/usr/bin/env node
// Screenshot einer Komponente oder Ansicht nach shots/.
//   node tools/shot.mjs music                 Schichten-Reihe (alle 5 Schichten) des gewählten Layouts
//   node tools/shot.mjs music warteschlange   … eines bestimmten Layouts
//   node tools/shot.mjs music --layouts       alle Layouts nebeneinander
//   node tools/shot.mjs --canvas              die ganze Fabrik (Übersicht)
//   node tools/shot.mjs music --build         Bauen-Ansicht, Endzustand
//   Optionen: --width=2000 --height=900 --scale=2 --web (Web-Bilder statt Platzhalter) --system=zds
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { withPage, pageURL, ROOT } from './_chrome.mjs';

const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
const [id, layout] = args.filter(a => !a.startsWith('-'));
const view = args.includes('--canvas') ? 'canvas' : args.includes('--layouts') ? 'layouts' : args.includes('--build') ? 'build' : 'layers';

const p = new URLSearchParams({ view });
if (id) { p.set('c', id); p.set('solo', ''); }
if (layout) p.set('l', layout);
p.set('still', '');
p.set('media', args.includes('--web') ? 'web' : 'none');
if (opt('system')) p.set('system', opt('system'));
const width = +(opt('width') || (view === 'layers' ? 2000 : view === 'layouts' ? 1320 : 1600));
const fixedH = opt('height') ? +opt('height') : null;
const scale = +(opt('scale') || 1);

mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
const name = [id || 'alle', layout, view, opt('system')].filter(Boolean).join('-');
const out = path.join(ROOT, 'shots', `${name}.png`);

const errors = await withPage(pageURL(p.toString().replace(/=(&|$)/g, '$1')), async page => {
  const ok = await page.waitFor("document.documentElement.dataset.ready === '1'", 30000);
  if (!ok) throw new Error(`Seite nicht fertig geworden. ${page.errors.join(' | ')}`);
  await page.eval(`Promise.race([Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))), new Promise(r => setTimeout(r, 5000))])`);
  const h = fixedH || (view === 'canvas' || view === 'build' ? 1000 : Math.min(6000, await page.eval('document.documentElement.scrollHeight')));
  await page.resize(width, h);
  await new Promise(r => setTimeout(r, 300));
  writeFileSync(out, await page.shot());
  return page.errors;
}, { width, height: fixedH || 1000, scale });

console.log(out);
for (const e of errors) console.error(`Skriptfehler: ${e}`);

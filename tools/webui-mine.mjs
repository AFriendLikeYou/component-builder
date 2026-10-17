#!/usr/bin/env node
// Korpus aus WebUI (Wu et al., CHI 2023): sucht in echten Webseiten kartengroße Gruppen und speichert sie als Skelette –
// nur Geometrie, Rollen und Schriftgrößen, keine Texte, keine Bilder. Grundlage für Skelett-Muster und Plausibilität.
//   node tools/webui-mine.mjs <ordner>                      jeder Unterordner = eine WebUI-Seite (wie sample/<id>/)
//   Optionen: --device="iPhone-13 Pro" --limit=500 --out=korpus/webui.json
// Daten: https://github.com/js0nwu/webui (Download über Hugging Face, Nutzungsbedingungen in COPYRIGHT.txt).
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { ROOT } from './_chrome.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const dir = args.find(a => !a.startsWith('-'));
if (!dir) { console.error('Aufruf: node tools/webui-mine.mjs <ordner mit WebUI-Seiten> [--device=…] [--limit=…] [--out=…]'); process.exit(2); }
const device = opt('device', 'iPhone-13 Pro'), limit = +opt('limit', 1e9), out = path.resolve(ROOT, opt('out', 'korpus/webui.json'));

// Kartengröße auf dem Telefon (390 breit): Gruppen zwischen diesen Maßen gelten als Komponente
const CARD = { minW: 240, maxW: 430, minH: 64, maxH: 720, minItems: 2, maxItems: 12 };
const MEDIA = new Set(['img', 'image', 'figure', 'video', 'canvas', 'graphics-document', 'svg']);
const CONTROL = new Set(['button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'switch', 'slider', 'spinbutton', 'tab', 'menuitem', 'option']);
const TEXT = new Set(['StaticText']);

const read = f => { const p = f + (existsSync(f + '.gz') ? '.gz' : ''); if (!existsSync(p)) return null; const b = readFileSync(p); return JSON.parse(p.endsWith('.gz') ? gunzipSync(b) : b); };
const area = r => r.w * r.h;
const inside = (a, b) => a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.w <= b.x + b.w + 1 && a.y + a.h <= b.y + b.h + 1;
const ovX = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
const ovY = (a, b) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
const union = (a, b) => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };
const r1 = v => Math.round(v);

function minePage(base) {
  const ax = read(`${base}-axtree.json`), bb = read(`${base}-bb.json`);
  if (!ax || !bb) return [];
  const style = read(`${base}-style.json`) || {};
  const nodes = new Map(ax.nodes.map(n => [n.nodeId, n]));
  const box = n => { const b = bb[n.backendDOMNodeId]; return b && b.width > 1 && b.height > 1 ? { x: b.x, y: b.y, w: b.width, h: b.height } : null; };
  const role = n => n.role?.value;
  const up = n => { const out = []; for (let p = nodes.get(n.parentId); p; p = nodes.get(p.parentId)) out.push(p); return out; };
  const fontOf = n => { for (const p of [n, ...up(n)]) { const s = style[p.backendDOMNodeId]; if (s?.['font-size']) return { size: parseFloat(s['font-size']), weight: parseInt(s['font-weight'], 10) || 400 }; } return { size: 0, weight: 400 }; };

  // Inhaltselemente: Medien, Bedienelemente, Texte (Text in Bedienelementen gehört zum Bedienelement)
  const items = [];
  for (const n of ax.nodes) {
    if (n.ignored) continue;
    const r = role(n), b = box(n);
    if (!b) continue;
    if (MEDIA.has(r) && b.w >= 24 && b.h >= 24) items.push({ role: 'media', ...b });
    // Links im Fließtext sind Text, keine Bedienelemente
    else if (CONTROL.has(r) && !(r === 'link' && up(n).some(p => role(p) === 'paragraph'))) items.push({ role: 'control', ...b });
    else if (TEXT.has(r) && !up(n).some(p => CONTROL.has(role(p)))) items.push({ role: 'text', ...b, ...fontOf(n) });
  }

  // Kandidaten: kartengroße Container mit 2–12 Inhalten aus mindestens zwei Rollen
  const cands = [];
  for (const n of ax.nodes) {
    const b = box(n);
    if (!b || b.w < CARD.minW || b.w > CARD.maxW || b.h < CARD.minH || b.h > CARD.maxH) continue;
    const its = items.filter(i => inside(i, b));
    if (its.length < CARD.minItems || its.length > CARD.maxItems || new Set(its.map(i => i.role)).size < 2) continue;
    cands.push({ n, b, its, key: its.map(i => `${i.x},${i.y}`).sort().join('|') });
  }
  // gleiche Inhalte in mehreren verschachtelten Containern: nur den engsten behalten
  const best = new Map();
  for (const c of cands) { const o = best.get(c.key); if (!o || area(c.b) < area(o.b)) best.set(c.key, c); }
  return [...best.values()].map(c => skeleton(c.b, c.its));
}

// Inhalte zu Blöcken zusammenfassen (Textzeilen untereinander, Knöpfe nebeneinander), relativ zum Container
function skeleton(b, its) {
  const blocks = [];
  for (const i of [...its].sort((p, q) => p.y - q.y || p.x - q.x)) {
    const k = blocks.find(o => o.role === i.role && i.role !== 'media' && (
      (ovX(o, i) > 0 && i.y - (o.y + o.h) <= 12 && i.y >= o.y) ||
      (i.role === 'control' && ovY(o, i) > 0 && i.x - (o.x + o.w) <= 16)));
    if (k) { Object.assign(k, union(k, i)); k.size = Math.max(k.size || 0, i.size || 0); k.n++; }
    else blocks.push({ role: i.role, x: i.x, y: i.y, w: i.w, h: i.h, size: i.size || 0, n: 1 });
  }
  const rel = blocks.map(k => ({ role: k.role, x: r1(k.x - b.x), y: r1(k.y - b.y), w: r1(k.w), h: r1(k.h), ...(k.size ? { size: r1(k.size) } : {}), n: k.n }));
  // Zeilen: Blöcke, die sich vertikal überlappen; Signatur = Rollen je Zeile von oben nach unten
  const rows = [];
  for (const k of [...rel].sort((p, q) => p.y - q.y)) { const r = rows.find(row => row.some(o => ovY(o, k) > Math.min(o.h, k.h) / 2)); r ? r.push(k) : rows.push([k]); }
  const sig = rows.map(r => r.sort((p, q) => p.x - q.x).map(k => k.role).join('+')).join(' / ');
  const sizes = [...new Set(rel.filter(k => k.size).map(k => k.size))].sort((p, q) => q - p);
  return {
    w: r1(b.w), h: r1(b.h), sig, blocks: rel,
    mediaShare: +(Math.max(0, ...rel.filter(k => k.role === 'media').map(k => k.w * k.h)) / (b.w * b.h)).toFixed(2),
    typeRatio: sizes.length > 1 ? +(sizes[0] / sizes[1]).toFixed(2) : 1,
    edges: new Set(rel.filter(k => !rows.some(r => r.length > 1 && r.includes(k))).map(k => Math.round(k.x / 8))).size,
  };
}

const pages = readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).slice(0, limit);
const comps = [];
let used = 0;
for (const p of pages) {
  const found = minePage(path.join(dir, p, device));
  if (found.length) used++;
  found.forEach(s => comps.push({ page: p, ...s }));
}
const sigs = {};
for (const s of comps) sigs[s.sig] = (sigs[s.sig] || 0) + 1;
const ranked = Object.entries(sigs).sort((a, b) => b[1] - a[1]);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ source: 'WebUI (Wu et al., CHI 2023)', device, pages: pages.length, pagesWithComponents: used, components: comps, signatures: Object.fromEntries(ranked) }, null, 1));

const pct = n => `${(100 * n / Math.max(1, comps.length)).toFixed(1)} %`;
const med = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
console.log(`WebUI · ${device} · ${pages.length} Seiten, davon ${used} mit Komponenten · ${comps.length} Komponenten · ${ranked.length} Signaturen`);
console.log(`Median: ${med(comps.map(c => c.w))} × ${med(comps.map(c => c.h))} px · Bildanteil ${med(comps.map(c => c.mediaShare))} · Schriftsprung ${med(comps.map(c => c.typeRatio))}× · ${med(comps.map(c => c.edges))} linke Kanten`);
ranked.slice(0, 15).forEach(([s, n]) => console.log(`${String(n).padStart(6)}  ${pct(n).padStart(7)}  ${s}`));
console.log(`\nGespeichert: ${path.relative(ROOT, out)}`);

#!/usr/bin/env node
// Übergabe: schreibt Tokens, HTML/CSS und Figma-Daten nach export/<regelwerk>/.
//   node tools/export.mjs tokens                     Tokens als W3C-Design-Tokens (tokens.json) und CSS-Variablen (tokens.css)
//   node tools/export.mjs html music                 eigenständige HTML-Seite mit allen Layouts (export/fabrik/music/music.html)
//   node tools/export.mjs figma music                Baum für Figma (export/fabrik/music.figma.json), gebaut von tools/figma-builder.js
//   node tools/export.mjs wc music                   Web Component <cf-music> (export/fabrik/music/music.wc.js + Beispielseite)
//   node tools/export.mjs all                        alles für alle Komponenten (anderes Regelwerk: --system <id>)
// Ausgabe am Ende als JSON-Zeile mit den geschriebenen Dateien.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { withPage, pageURL, ROOT } from './_chrome.mjs';

const args = process.argv.slice(2);
const sysArg = args.find(a => a.startsWith('--system'));
const system = sysArg ? (sysArg.includes('=') ? sysArg.split('=')[1] : args[args.indexOf(sysArg) + 1]) : 'fabrik';
const [kind, id] = args.filter((a, i) => !a.startsWith('-') && !(sysArg && !sysArg.includes('=') && args[i - 1] === sysArg));
if (!['tokens', 'html', 'figma', 'wc', 'all'].includes(kind)) {
  console.error('Aufruf: node tools/export.mjs tokens|html|figma|wc|all [komponente] [--system <id>]');
  process.exit(2);
}
const out = path.join(ROOT, 'export', system);
mkdirSync(out, { recursive: true });
const written = [];
const write = (rel, text) => { const f = path.join(out, rel); mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, text); written.push(path.relative(ROOT, f)); };

function tokenFiles(t) {
  const name = n => n.replace(/^--/, '');
  const dtcg = {
    $description: `${t.name} (System v${t.version}) – exportiert aus der Component Factory`,
    color: Object.fromEntries(t.colors.map(c => [name(c.name), { $type: 'color', $value: c.a < 1 ? `${c.hex}${Math.round(c.a * 255).toString(16).padStart(2, '0')}` : c.hex }])),
    spacing: Object.fromEntries(t.spacing.map(v => [String(v), { $type: 'dimension', $value: `${v}px` }])),
    radius: { card: { $type: 'dimension', $value: `${t.radius.card}px` }, ...Object.fromEntries(t.radius.inner.filter(r => r !== 'pill').map(r => [String(r), { $type: 'dimension', $value: `${r}px` }])), pill: { $type: 'dimension', $value: '999px' } },
    font: {
      family: Object.fromEntries(Object.keys(t.families).map(f => [f.toLowerCase().replace(/\s+/g, '-'), { $type: 'fontFamily', $value: f, $description: t.families[f] }])),
      size: Object.fromEntries(t.typeScale.map(v => [String(v), { $type: 'dimension', $value: `${v}px` }])),
    },
    typography: Object.fromEntries(t.textStyles.map(s => [s.id, { $type: 'typography', $value: { fontFamily: s.family, fontSize: `${s.size}px`, fontWeight: s.weight, lineHeight: `${s.lh}px` }, $description: s.name }])),
    layout: { unit: { $type: 'dimension', $value: `${t.grid.unit}px` }, inset: { $type: 'dimension', $value: `${t.grid.inset}px` }, 'card-width': { $type: 'dimension', $value: `${t.grid.width}px` } },
  };
  const css = `/* ${t.name} – Tokens aus der Component Factory (System v${t.version}) */\n:root {\n${t.colors.map(c => `  ${c.name}: ${c.a < 1 ? `rgba(${parseInt(c.hex.slice(1, 3), 16)}, ${parseInt(c.hex.slice(3, 5), 16)}, ${parseInt(c.hex.slice(5, 7), 16)}, ${c.a})` : c.hex};`).join('\n')}\n${t.spacing.map(v => `  --space-${v}: ${v}px;`).join('\n')}\n  --radius-card: ${t.radius.card}px;\n${t.radius.inner.filter(r => r !== 'pill').map(r => `  --radius-${r}: ${r}px;`).join('\n')}\n  --radius-pill: 999px;\n}\n${t.textStyles.map(s => `.text-${s.id} { font: ${s.weight} ${s.size}px/${s.lh}px "${s.family}", sans-serif; }`).join('\n')}\n`;
  write('tokens.json', JSON.stringify(dtcg, null, 2) + '\n');
  write('tokens.css', css);
}

// Web Component: der Quelltext der Komponente läuft unverändert in einem Custom Element mit Shadow DOM
function webComponent(cid, rt) {
  const src = readFileSync(path.join(ROOT, 'components', `${cid}.js`), 'utf8');
  let tweaks = null;
  const twFile = path.join(ROOT, 'components', `${cid}.tweaks.js`);
  if (existsSync(twFile)) new Function('Factory', readFileSync(twFile, 'utf8'))({ tweaks: (_, d) => { tweaks = d; } });
  const sysCSS = readFileSync(path.join(ROOT, 'systems', system, 'system.css'), 'utf8')
    .replace(/@import[^;]+;/g, '').replace(/:root\b/g, ':host');
  // componentCSS ist schon auf [data-c="<id>"] begrenzt (so steht es auch in der Fabrik)
  const css = `${sysCSS}\n:host { display: inline-block; --cf-radius: ${rt.system.radius}px; }\n${rt.componentCSS[cid] || ''}\n`;
  const tag = `cf-${cid}`;
  return `// <${tag}> – Web Component aus der Component Factory, Regelwerk „${rt.system.name}“ (systems/${system}), ${new Date().toISOString().slice(0, 10)}.
// Einbinden:  <script type="module" src="${cid}.wc.js"></script>   dann   <${tag} layout="${''}"></${tag}>
// Attribute:  layout (id eines Layouts), state (normal | hover | loading | empty | error), width (px)
// Eigenschaften: el.data = { … } (Standard: Beispieldaten der Komponente), el.images = ['url', …] für die Bildflächen
// Schriften gehören ins Dokument (z. B. systems/${system}/fonts.css); Tokens stecken im Shadow DOM und lassen sich per CSS-Variable von außen überschreiben.
(() => {
const SYSTEM = ${JSON.stringify(rt.system)};
const ICONS = ${JSON.stringify(rt.icons)};
const TWEAKS = ${JSON.stringify(tweaks)};
const CSS = ${JSON.stringify(css)};
let DEF = null;
const Factory = { register(def) { DEF = def; }, tweaks() {} };

// ---------- Komponente: components/${cid}.js (unverändert) ----------
${src}

// ---------- Laufzeit (aus der Fabrik) ----------
${rt.code}
const icon = (name, size = 20) => \`<svg class="icon" data-icon="\${name}" width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\${ICONS[name] || ICONS.more}</svg>\`;
const makeMedia = (cid, images) => (slot = 0, opt = {}) => {
  const key = \`\${cid}-\${slot}\`, src = images.length ? images[(hash(cid) + slot) % images.length] : null;
  const attrs = \`data-media class="cf-media\${opt.class ? ' ' + esc(opt.class) : ''}" style="\${placeholder(key)};\${esc(opt.style || '')}"\${opt.bleed ? ' data-bleed' : ''}\${opt.area ? \` data-area="\${esc(opt.area)}"\` : ''}\`;
  return src ? \`<div \${attrs}><img src="\${esc(src)}" alt="" decoding="async"></div>\` : \`<div \${attrs}></div>\`;
};

class El extends HTMLElement {
  static observedAttributes = ['layout', 'state', 'width'];
  #data = null; #images = []; #root;
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const st = document.createElement('style');
    st.textContent = CSS;
    this.#root = document.createElement('div');
    this.shadowRoot.append(st, this.#root);
  }
  get data() { return this.#data || DEF.data; }
  set data(v) { this.#data = v; this.render(); }
  get images() { return this.#images; }
  set images(v) { this.#images = Array.isArray(v) ? v : []; this.render(); }
  get layouts() { return DEF.layouts.map(l => ({ id: l.id, name: l.name })); }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }
  render() {
    if (!this.isConnected) return;
    NOW = new Date();
    const l = DEF.layouts.find(x => x.id === this.getAttribute('layout')) || DEF.layouts[0];
    const w = +this.getAttribute('width') || l.width || SYSTEM.width;
    const state = this.getAttribute('state') || 'normal';
    const h = { media: makeMedia(DEF.id, this.#images), icon, esc, pad2, zoned, now: NOW, S: SYSTEM, state, width: w };
    let inner;
    try { inner = l.render(this.data, h); } catch (e) { inner = \`<p style="color:#c9423a;font:12px monospace">\${esc(e.message)}</p>\`; }
    const tw = TWEAKS && TWEAKS[l.id];
    inner = applyTweaks(inner, tw);
    const H = (tw && tw.height) || (typeof l.height === 'function' ? l.height(w) : l.height);
    const dk = l.dark ?? DEF.dark;
    const cls = \`cf-card\${(typeof dk === 'function' ? dk(SYSTEM) : dk) ? ' is-dark' : ''}\${state !== 'normal' ? \` is-state-\${state}\${state === 'hover' ? ' is-hover' : ''}\` : ''}\`;
    this.#root.innerHTML = \`<div class="\${cls}" data-c="\${DEF.id}" data-l="\${l.id}" style="width:\${w}px;\${H ? \`height:\${H}px;\` : ''}padding:\${l.padding ?? SYSTEM.inset}px">\${inner}</div>\`;
  }
}
if (!customElements.get('${tag}')) customElements.define('${tag}', El);
})();
`;
}
function webComponentDemo(cid, rt, layouts) {
  const tag = `cf-${cid}`, fonts = existsSync(path.join(ROOT, 'systems', system, 'fonts.css')) ? `<link rel="stylesheet" href="../../../systems/${system}/fonts.css">\n` : '';
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>&lt;${tag}&gt; · ${rt.system.name}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Libre+Baskerville:ital,wght@0,400;1,400&display=swap">
${fonts}<script type="module" src="${cid}.wc.js"></script>
<style>body { margin: 0; padding: 40px; background: #f7f7f5; font: 14px/20px system-ui, sans-serif; } .row { display: flex; flex-wrap: wrap; gap: 40px; align-items: flex-start; } figure { margin: 0; } figcaption { margin-bottom: 12px; font: 12px/16px ui-monospace, monospace; color: #6b6b6b; } pre { margin-top: 40px; padding: 16px; background: #fff; border-radius: 12px; font: 12px/18px ui-monospace, monospace; }</style>
</head>
<body>
<h1 style="font-size:20px;font-weight:500;margin:0 0 24px">&lt;${tag}&gt; <span style="color:#9e9e9e;font-weight:400">· ${rt.system.name}</span></h1>
<div class="row">
${layouts.map(l => `<figure><figcaption>layout="${l.id}"</figcaption><${tag} layout="${l.id}"></${tag}></figure>`).join('\n')}
</div>
<pre>&lt;script type="module" src="${cid}.wc.js"&gt;&lt;/script&gt;
&lt;${tag} layout="${layouts[0].id}"&gt;&lt;/${tag}&gt;

const el = document.querySelector('${tag}');
el.data = { …eigene Inhalte… };      // Standard: Beispieldaten
el.images = ['bild-1.jpg', 'bild-2.jpg'];
el.setAttribute('state', 'loading');  // normal | hover | loading | empty | error
el.setAttribute('width', '320');</pre>
</body>
</html>
`;
}

// Figma-Daten verdichten: Standardwerte weglassen, nur benutzte Tokens mitgeben (die Daten laufen durch figma_execute)
function compactFigma(data, trees = data.layouts.map(l => l.tree)) {
  const used = new Set();
  const drop = (o, k, v) => { if (JSON.stringify(o[k]) === JSON.stringify(v)) delete o[k]; };
  const col = c => { if (c && c.token) used.add(c.token); if (c && c.token === null) delete c.token; };
  const walk = n => {
    drop(n, 'opacity', 1); drop(n, 'vars', []); drop(n, 'abs', false); drop(n, 'grow', false); drop(n, 'area', null);
    if (/^(auto|normal)$/.test(n.alignSelf || '')) delete n.alignSelf;
    for (const k of ['fill', 'gradient', 'stroke', 'img', 'icon', 'clamp']) drop(n, k, null);
    for (const k of ['clip', 'truncate', 'nowrap', 'bleed']) drop(n, k, false);
    drop(n, 'shadows', []); drop(n, 'pad', [0, 0, 0, 0]); drop(n, 'radius', [0, 0, 0, 0]);
    if (n.name === n.area) delete n.area;
    col(n.fill); col(n.color); if (n.stroke) col(n.stroke.color); (n.shadows || []).forEach(x => col(x.color));
    if (n.align === 'left' || n.align === 'start') delete n.align;
    if (n.layout) { for (const k of ['crossGap', 'gap']) drop(n.layout, k, 0); drop(n.layout, 'wrap', false); drop(n.layout, 'reverse', false); }
    for (const r of n.runs || []) { const st = r.style; drop(st, 'ls', 0); drop(st, 'italic', false); drop(st, 'strike', false); drop(st, 'tabular', false); col(st.color); }
    if (n.type === 'svg') delete n.color;
    (n.children || []).forEach(walk);
    for (const k of Object.keys(n)) if (typeof n[k] === 'number') n[k] = Math.round(n[k] * 10) / 10;
  };
  trees.forEach(walk);
  if (data.ink) col(data.ink);
  data.tokens = data.tokens.filter(t => used.has(t.name));
  return data;
}

const result = await withPage(pageURL(`view=layouts&still&media=none&system=${encodeURIComponent(system)}`), async page => {
  const ok = await page.waitFor("document.documentElement.dataset.ready === '1'", 30000);
  if (!ok) throw new Error(`Seite nicht fertig. ${page.errors.join(' | ')}`);
  const ids = id ? [id] : await page.eval('Factory.components.map(c => c.id)');
  if (kind === 'tokens' || kind === 'all') tokenFiles(await page.eval('Factory.exportTokens()'));
  const rt = kind === 'wc' || kind === 'all' ? await page.eval('Factory.exportRuntime()') : null;
  for (const cid of ids) {
    if (rt) {
      write(`${cid}/${cid}.wc.js`, webComponent(cid, rt));
      write(`${cid}/${cid}.wc.html`, webComponentDemo(cid, rt, await page.eval(`Factory.byId[${JSON.stringify(cid)}].layouts.map(l => ({ id: l.id, name: l.name }))`)));
    }
    if (kind === 'html' || kind === 'all') write(`${cid}/${cid}.html`, await page.eval(`Factory.exportHTML(${JSON.stringify(cid)})`));
    if (kind === 'figma' || kind === 'all') write(`${cid}.figma.json`, JSON.stringify(compactFigma(await page.eval(`Factory.exportFigma(${JSON.stringify(cid)})`))));
  }
  // Bausteine und Icons einmal je Regelwerk: in Figma zuerst CF.buildAtoms(…), danach die Komponenten
  if (kind === 'figma' || kind === 'all') {
    const atoms = await page.eval('Factory.exportFigmaAtoms()');
    write('_bausteine.figma.json', JSON.stringify(compactFigma(atoms, atoms.atoms.flatMap(a => a.sets.map(x => x.tree)))));
  }
  return { errors: page.errors };
}, { width: 1600, height: 1200 });

console.log(JSON.stringify({ ok: true, system, files: written, errors: result.errors }));

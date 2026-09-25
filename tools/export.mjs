#!/usr/bin/env node
// Übergabe: schreibt Tokens, HTML/CSS und Figma-Daten nach export/<regelwerk>/.
//   node tools/export.mjs tokens --system zds        Tokens als W3C-Design-Tokens (tokens.json) und CSS-Variablen (tokens.css)
//   node tools/export.mjs html music --system zds    eigenständige HTML-Seite mit allen Layouts (export/zds/music/music.html)
//   node tools/export.mjs figma music --system zds   Baum für Figma (export/zds/music.figma.json), gebaut von tools/figma-builder.js
//   node tools/export.mjs all --system zds           alles für alle Komponenten
// Ausgabe am Ende als JSON-Zeile mit den geschriebenen Dateien.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { withPage, pageURL, ROOT } from './_chrome.mjs';

const args = process.argv.slice(2);
const sysArg = args.find(a => a.startsWith('--system'));
const system = sysArg ? (sysArg.includes('=') ? sysArg.split('=')[1] : args[args.indexOf(sysArg) + 1]) : 'fabrik';
const [kind, id] = args.filter((a, i) => !a.startsWith('-') && !(sysArg && !sysArg.includes('=') && args[i - 1] === sysArg));
if (!['tokens', 'html', 'figma', 'all'].includes(kind)) {
  console.error('Aufruf: node tools/export.mjs tokens|html|figma|all [komponente] [--system <id>]');
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

const result = await withPage(pageURL(`view=layouts&still&media=none&system=${encodeURIComponent(system)}`), async page => {
  const ok = await page.waitFor("document.documentElement.dataset.ready === '1'", 30000);
  if (!ok) throw new Error(`Seite nicht fertig. ${page.errors.join(' | ')}`);
  const ids = id ? [id] : await page.eval('Factory.components.map(c => c.id)');
  if (kind === 'tokens' || kind === 'all') tokenFiles(await page.eval('Factory.exportTokens()'));
  for (const cid of ids) {
    if (kind === 'html' || kind === 'all') write(`${cid}/${cid}.html`, await page.eval(`Factory.exportHTML(${JSON.stringify(cid)})`));
    if (kind === 'figma' || kind === 'all') write(`${cid}.figma.json`, JSON.stringify(await page.eval(`Factory.exportFigma(${JSON.stringify(cid)})`)));
  }
  return { errors: page.errors };
}, { width: 1600, height: 1200 });

console.log(JSON.stringify({ ok: true, system, files: written, errors: result.errors }));

#!/usr/bin/env node
// Prüft alle (oder die genannten) Komponenten gegen das Regelwerk in factory/system.js.
//   node tools/check.mjs              alle Komponenten
//   node tools/check.mjs music inbox  nur diese
//   node tools/check.mjs --json       Rohbericht
//   node tools/check.mjs --stress     zusätzlich Stresstest (lange Wörter, leer, ein Eintrag, zwölf Einträge)
// Exit-Code 1, wenn es Verstöße gibt.
import { withPage, pageURL } from './_chrome.mjs';

const args = process.argv.slice(2);
const only = args.filter(a => !a.startsWith('-'));
const asJSON = args.includes('--json');
const stress = args.includes('--stress');

let report, pageErrors = [];
try {
  report = await withPage(pageURL(stress ? 'check&stress' : 'check'), async page => {
    const done = await page.waitFor("document.documentElement.dataset.done === '1'", 30000);
    pageErrors = page.errors;
    return done ? JSON.parse(await page.eval("document.getElementById('cf-report').textContent")) : null;
  });
} catch (e) {
  console.error(`Chrome-Lauf fehlgeschlagen: ${e.message}`);
  process.exit(2);
}
if (!report) {
  console.error('Kein Prüfbericht – die Seite ist nicht fertig geworden.');
  for (const e of pageErrors) console.error(`  Skriptfehler: ${e}`);
  process.exit(2);
}
for (const e of pageErrors) if (!report.loadErrors.some(x => e.includes(x))) report.loadErrors.push(`Skriptfehler: ${e}`);
const comps = only.length ? report.components.filter(c => only.includes(c.id)) : report.components;
const missing = only.filter(id => !report.components.some(c => c.id === id));

if (asJSON) {
  console.log(JSON.stringify({ ...report, components: comps }, null, 2));
  process.exit(comps.some(c => c.layouts.some(l => l.violations.length)) ? 1 : 0);
}

const { unit, inset, limits } = report.system;
const dim = s => `\x1b[2m${s}\x1b[0m`, red = s => `\x1b[31m${s}\x1b[0m`, green = s => `\x1b[32m${s}\x1b[0m`;
console.log(dim(`Component Factory · Prüfung · Raster ${unit} px · Inset ${inset} px · max. ${limits.sizes} Größen / ${limits.weights} Schnitte / ${limits.families} Familien`));

const loadErr = report.loadErrors.filter(e => !only.length || only.some(id => e.includes(id)));
for (const e of loadErr) console.log(red(`✕ Ladefehler: ${e}`));
for (const id of missing) if (!loadErr.some(e => e.includes(id))) console.log(red(`✕ ${id}: nicht registriert (in components/_index.js eingetragen?)`));

let total = 0;
for (const c of comps) {
  const n = c.layouts.reduce((s, l) => s + l.violations.length, 0);
  total += n;
  console.log(`\n${n ? red('✕') : green('✓')} ${c.name} ${dim(`(${c.id})`)}`);
  for (const l of c.layouts) {
    const t = l.type;
    const meta = `${l.w} × ${l.h} · ${l.areas} Flächen · ${t.sizes.join('/')} px · ${t.weights.join('/')} · ${t.families.map(f => f.replace('Libre ', '')).join(' + ')}`;
    console.log(`  ${l.violations.length ? red('✕') : green('✓')} ${l.name.padEnd(16)} ${dim(meta)}`);
    for (const v of l.violations) console.log(`      ${red(v.rule.padEnd(9))} ${v.msg}`);
  }
}
if (stress) {
  const st = (report.stress || []).filter(x => !only.length || only.includes(x.c));
  console.log(`\n${st.length ? red(`Stresstest: ${st.length} Fälle brechen`) : green('Stresstest: alle Fälle halten')}`);
  for (const x of st) {
    console.log(`  ${red('✕')} ${x.name} / ${x.lname} ${dim(`· ${x.scenario}`)}`);
    for (const v of x.violations.slice(0, 3)) console.log(`      ${red(v.rule.padEnd(9))} ${v.msg}`);
    if (x.violations.length > 3) console.log(dim(`      … ${x.violations.length - 3} weitere`));
  }
}
const layouts = comps.reduce((s, c) => s + c.layouts.length, 0);
console.log(`\n${total || loadErr.length || missing.length ? red(`${total} Verstöße`) : green('Alles im Raster')} ${dim(`· ${comps.length} Komponenten · ${layouts} Layouts`)}`);
process.exit(total || loadErr.length || missing.length ? 1 : 0);

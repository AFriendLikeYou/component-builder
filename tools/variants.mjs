#!/usr/bin/env node
// Varianten-Wand für Claude: ordnet die Flächen eines Layouts als Skelette neu an (Bild oben, seitlich, randabfallend,
// Bühne, zentriert …), verwirft ungültige und zu ähnliche Pläne und macht einen Screenshot der Wand.
//   node tools/variants.mjs music cover              bis zu 12 Skelette
//   node tools/variants.mjs music cover --n=24       mehr
//   node tools/variants.mjs music cover --prompt=3   die Bauanweisung für Skelett 3 ausgeben
//   Optionen: --system=<id> --json
// Danach das Bild ansehen (Read), zwei, drei Skelette wählen und je eines als Variante bauen (Anweisung per --prompt).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { withPage, pageURL, ROOT } from './_chrome.mjs';

const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
const [id, layout] = args.filter(a => !a.startsWith('-'));
if (!id) { console.error('Aufruf: node tools/variants.mjs <komponente> [layout] [--n=12] [--prompt=<nr>]'); process.exit(2); }
const system = opt('system') || 'fabrik', n = +(opt('n') || 12), want = opt('prompt');

mkdirSync(path.join(ROOT, 'shots'), { recursive: true });
const file = path.join(ROOT, 'shots', `${id}-skelette.jpg`);
const res = await withPage(pageURL(`view=layouts&c=${encodeURIComponent(id)}&solo&still&media=none&system=${encodeURIComponent(system)}&skel=${encodeURIComponent(layout || '')}&n=${n}`), async page => {
  if (!await page.waitFor("document.documentElement.dataset.ready === '1' && !!document.querySelector('.cf-skelwall')", 30000)) throw new Error(`Keine Wand für „${id}“ – gibt es die Komponente?`);
  const box = JSON.parse(await page.eval(`JSON.stringify((() => { const r = document.querySelector('.cf-skelwall').getBoundingClientRect(); return { x: r.left - 16 + scrollX, y: r.top - 16 + scrollY, width: r.width + 32, height: r.height + 32 }; })())`));
  writeFileSync(file, await page.shot({ jpeg: 70, clip: box }));
  return JSON.parse(await page.eval(`JSON.stringify({ wall: Factory.skeletons, prompts: Factory.skeletons.items.map((_, i) => Factory.skeletonPrompt(Factory.skeletons.c, Factory.skeletons.l, i)) })`));
}, { width: 1320, height: 1000 });

const { wall, prompts } = res;
if (want != null) { console.log(prompts[+want - 1] || `Kein Skelett ${want} (1–${prompts.length})`); process.exit(prompts[+want - 1] ? 0 : 2); }
if (args.includes('--json')) { console.log(JSON.stringify(wall, null, 2)); process.exit(0); }
const st = sk => !sk.check ? '' : sk.check.muss.length ? ` · ✕ ${sk.check.muss[0]}` : sk.check.soll.length ? ` · Hinweis: ${sk.check.soll[0]}` : ' · hält';
const line = (nr, sk) => `${String(nr).padStart(2)}  ${sk.name.padEnd(30)} ${`${sk.w} × ${sk.h}`.padEnd(10)} ${(sk.focus || 'kein Blickfang').padEnd(14)} ${sk.dist != null ? `${Math.round(sk.dist * 100)} % anders` : ''}${sk.dir ? ` · ${sk.dir}` : ''}${st(sk)}`;
console.log(`Skelette für ${wall.c} / ${wall.l} · ${wall.items.length} gezeigt, ${wall.rejected.length} verworfen (ungültig oder zu ähnlich) · Vorschau mit echtem Inhalt geprüft`);
console.log(line(0, wall.base).replace(/^ 0/, ' –'));
wall.items.forEach((sk, i) => console.log(line(i + 1, sk)));
console.log(`\nBild: ${path.relative(ROOT, file)} – ansehen, dann Anweisung holen: node tools/variants.mjs ${id} ${wall.l} --prompt=<nr>`);

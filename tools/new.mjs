#!/usr/bin/env node
// Gerüst für eine neue Komponente: legt components/<id>.js mit drei regelkonformen Platzhalter-Layouts an und trägt die id
// in components/_index.js ein. Danach nur noch Inhalte, Flächen und CSS ausbauen – kein Tippen von Grundgerüst mehr.
//   node tools/new.mjs pegel "Pegel"                              drei Layouts „Layout 1–3“
//   node tools/new.mjs pegel "Pegel" stand:Stand verlauf:Verlauf tiden:Tiden
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './_chrome.mjs';

const [id, name, ...lays] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9-]*$/.test(id) || !name) { console.error('Aufruf: node tools/new.mjs <id> "<Name>" [layout-id:Name …]'); process.exit(2); }
const file = path.join(ROOT, 'components', `${id}.js`);
if (existsSync(file)) { console.error(`components/${id}.js gibt es schon.`); process.exit(1); }
const layouts = (lays.length ? lays : ['a:Layout 1', 'b:Layout 2', 'c:Layout 3']).map(s => { const [lid, ...n] = s.split(':'); return { id: lid, name: n.join(':') || lid }; });
const px = id.replace(/-/g, '').slice(0, 2);
const q = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
// Höhe: 24 Inset + 24 Kopfzeile + 16 Abstand + 112 Inhalt + 24 Inset = 200
const src = `// ${name}: <was die Komponente zeigt – ein Satz>. Gerüst aus tools/new.mjs; Inhalte, Flächen und CSS ausbauen.
Factory.register({
  id: ${q(id)},
  name: ${q(name)},
  aliases: [${q(id)}],
  data: {
    title: ${q(name)},
  },
  css: \`
    .${px} { display: flex; flex-direction: column; gap: 16px; }
    .${px}-body { height: 112px; }
  \`,
  layouts: [
${layouts.map(l => `    {
      id: ${q(l.id)},
      name: ${q(l.name)},
      idea: 'Was fällt zuerst auf – und warum?',
      height: 200,
      render: (d, h) => \`
        <div class="${px}">
          <div class="row between" data-area="text:kopf"><p class="t-16 w-500">\${h.esc(d.title)}</p></div>
          <div class="${px}-body" data-area="text:inhalt"></div>
        </div>\`,
    },`).join('\n')}
  ],
});
`;
writeFileSync(file, src);
const idx = path.join(ROOT, 'components', '_index.js');
const cur = readFileSync(idx, 'utf8');
if (!cur.includes(`'${id}'`)) writeFileSync(idx, cur.replace(/\n\]\);\s*$/, `\n  '${id}',\n]);\n`));
console.log(`components/${id}.js angelegt (${layouts.length} Layouts: ${layouts.map(l => l.id).join(', ')}), in components/_index.js eingetragen. CSS-Präfix .${px}-. Jetzt ausbauen, dann node tools/verify.mjs ${id}.`);

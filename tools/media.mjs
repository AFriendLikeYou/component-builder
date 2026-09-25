#!/usr/bin/env node
// Schreibt media/_media.js mit allen Bildern und Videos aus media/.
// Danach in der Fabrik oben rechts „Bilder: Ordner“ wählen. (Mit tools/serve.mjs passiert das automatisch.)
import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './_chrome.mjs';

export function listMedia() {
  const dir = path.join(ROOT, 'media');
  return readdirSync(dir)
    .filter(f => /\.(jpe?g|png|webp|avif|gif|mp4|webm|mov|m4v)$/i.test(f) && !f.startsWith('.'))
    .sort()
    .map(f => `media/${f}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const list = listMedia();
  writeFileSync(path.join(ROOT, 'media', '_media.js'), `window.MEDIA = ${JSON.stringify(list, null, 2)};\n`);
  console.log(`${list.length} Dateien in media/_media.js eingetragen.`);
}

#!/usr/bin/env node
// Bereitet die Fabrik als claude.ai-Artifact vor: dist/artifact.html (ohne html/head/body – die setzt die Plattform)
// und dist/_index.js mit allen Komponenten, deren Datei existiert. Gibt die Dateiliste für die Veröffentlichung aus.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './_chrome.mjs';

const dist = path.join(ROOT, 'dist');
mkdirSync(dist, { recursive: true });

const page = readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<\/?html[^>]*>\s*/gi, '')
  .replace(/<\/?head>\s*/gi, '')
  .replace(/<\/?body>\s*/gi, '')
  .replace(/<meta [^>]*>\s*/gi, '');
writeFileSync(path.join(dist, 'artifact.html'), page);

const listed = [...readFileSync(path.join(ROOT, 'components', '_index.js'), 'utf8').matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]);
const ids = listed.filter(id => existsSync(path.join(ROOT, 'components', `${id}.js`)));
writeFileSync(path.join(dist, '_index.js'), `Factory.load(${JSON.stringify(ids)});\n`);

const files = {
  'factory/system.js': 'factory/system.js',
  'factory/system.css': 'factory/system.css',
  'factory/factory.css': 'factory/factory.css',
  'factory/factory.js': 'factory/factory.js',
  'components/_index.js': 'dist/_index.js',
  ...Object.fromEntries(ids.map(id => [`components/${id}.js`, `components/${id}.js`])),
};
const media = existsSync(path.join(ROOT, 'media')) ? readdirSync(path.join(ROOT, 'media')).filter(f => /\.(jpe?g|png|webp|avif|gif|mp4|webm)$/i.test(f)) : [];
console.log(JSON.stringify({ page: 'dist/artifact.html', components: ids, files, mediaNotPublished: media.length }, null, 2));

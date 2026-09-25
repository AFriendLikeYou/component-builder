// Brücke zu Claude Code: startet `claude -p` im Projektordner und übersetzt die Ereignisse
// in kurze Arbeitsschritte für die Anzeige („Denkt nach …“) in der Fabrik.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const BIN = process.env.CLAUDE_BIN || 'claude';
let available = null;
export function claudeAvailable() {
  if (available === null) {
    const r = spawnSync(BIN, ['--version'], { encoding: 'utf8' });
    available = r.status === 0;
  }
  return available;
}

const SYSTEM = `Du wirst aus der Oberfläche der Component Factory aufgerufen (Eingabezeile „Bauen“ oder Bearbeiten-Modus). Der Nutzer sieht deine Arbeitsschritte live mit.
Arbeite strikt nach CLAUDE.md und dem aktiven Regelwerk. Steht unten ein Kontext, ist das der aktuelle Stand dieser Dateien – lies sie nicht noch einmal. In components/<id>.tweaks.js gesperrte Flächen (locks) nie verändern, akzeptierte Ausnahmen (exceptions) nicht beheben. Leitsätze mit status bestaetigt gelten wie Soll-Regeln. Bedienelemente, Chips und Fortschrittsbalken nur aus den Bausteinen (atoms), Icons nur über h.icon.
- Lesen mit Read, suchen mit Grep und Glob. Shell nur für node tools/… sowie git log, git show, git diff und ls – ohne Pipes, Umleitungen oder &&, die Ausgaben sind kurz.
- Neue Komponente: zuerst node tools/new.mjs <id> "<Name>" <layout-id>:<Name> … (legt Datei und Eintrag in _index.js an), dann ausbauen.
- Änderungen an bestehenden Dateien mit Edit an den betroffenen Stellen, nicht die ganze Datei neu schreiben. Nur das Nötige ändern. Änderungen aus dem Bearbeiten-Modus (Auto-Layout) sind verbindlich: Reihenfolge, feste Größen und gap als Struktur im Code umsetzen (Markup/data, width/height, gap), nie mit absoluten Positionen oder translate.
- Danach immer: node tools/verify.mjs <id> [geänderte layout-ids] – prüft (mit Zuständen, falls vorhanden) und macht einen Screenshot. Das Bild jedes Mal ansehen (Read) und optische Fehler beheben; wiederholen, bis alles ✓ ist und gut aussieht.
- Zum Schluss höchstens zwei kurze Sätze auf Deutsch, was du gemacht hast. Letzte Zeile genau: ID: <id der betroffenen Komponente> (oder ID: - wenn keine).`;

const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash(node tools/verify.mjs:*)', 'Bash(node tools/new.mjs:*)', 'Bash(node tools/check.mjs:*)', 'Bash(node tools/shot.mjs:*)', 'Bash(node tools/export.mjs:*)',
  'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git diff:*)', 'Bash(ls:*)'];
// Nur für „Nach Figma“: Figma über figma-console (Plugin „Desktop Bridge“ muss laufen)
const FIGMA_TOOLS = ['mcp__figma-console__figma_get_status', 'mcp__figma-console__figma_navigate', 'mcp__figma-console__figma_execute'];

function stepFor(tool, input, root) {
  const rel = p => (p ? path.relative(root, p) || p : '');
  const bash = input.command || '';
  let m;
  switch (tool) {
    case 'Read': {
      const f = rel(input.file_path);
      if (f === 'CLAUDE.md') return { code: 'rules.read("CLAUDE.md")', kind: 'read' };
      if (f.startsWith('shots/')) return { code: `render.view("${path.basename(f)}")`, kind: 'view' };
      return { code: `file.read("${f}")`, kind: 'read' };
    }
    case 'Write': return { code: `component.write("${rel(input.file_path)}")`, kind: 'write', file: rel(input.file_path) };
    case 'Edit': case 'MultiEdit': return { code: `component.edit("${rel(input.file_path)}")`, kind: 'write', file: rel(input.file_path) };
    case 'Glob': return { code: `files.find("${input.pattern}")`, kind: 'find' };
    case 'Grep': return { code: `files.search("${input.pattern}")`, kind: 'find' };
    case 'Bash':
      if ((m = bash.match(/tools\/verify\.mjs\s*([^|&;>]*)/))) return { code: `rules.verify("${m[1].trim()}")`, kind: 'check' };
      if ((m = bash.match(/tools\/new\.mjs\s+([a-z0-9-]+)/))) return { code: `component.new("${m[1]}")`, kind: 'write', files: [`components/${m[1]}.js`, 'components/_index.js'] };
      if ((m = bash.match(/tools\/check\.mjs\s*([^|&;>]*)/))) return { code: `rules.check(${m[1].trim() ? `"${m[1].trim()}"` : ''})`, kind: 'check' };
      if ((m = bash.match(/tools\/shot\.mjs\s*([^|&;>]*)/))) return { code: `render.snapshot("${m[1].trim()}")`, kind: 'shot' };
      if ((m = bash.match(/tools\/export\.mjs\s*([^|&;>]*)/))) return { code: `handoff.export("${m[1].trim()}")`, kind: 'export' };
      return { code: `shell("${bash.slice(0, 40)}")`, kind: 'shell' };
    case 'TodoWrite': return null;
    case 'mcp__figma-console__figma_execute': return { code: 'figma.execute()', kind: 'figma' };
    case 'mcp__figma-console__figma_get_status': return { code: 'figma.status()', kind: 'figma' };
    case 'mcp__figma-console__figma_navigate': return { code: 'figma.navigate()', kind: 'figma' };
    default: return { code: `${tool.toLowerCase()}()`, kind: 'other' };
  }
}

function detailFor(kind, text, isError) {
  if (isError) return 'abgelehnt';
  if (kind === 'check') {
    const h = text.match(/(\d+) Hinweise/), hints = h ? ` · ${h[1]} Hinweise` : '';
    if (/Alles im Raster/.test(text)) return `im Raster${hints}`;
    const m = text.match(/(\d+) Verstöße/);
    return m ? `${m[1]} Verstöße${hints}` : 'geprüft';
  }
  if (kind === 'view') return 'angesehen';
  return null;
}

// Kontextpaket: was Claude sonst zu Beginn zusammensucht, gleich mitschicken – Regelwerk (Werte, Regeln, Bausteine,
// CSS), bestätigte Leitsätze, die letzten Entscheidungen und die Komponenten, um die es im Auftrag geht (Quelltext
// und Feinschliff). Claude muss diese Dateien dann nicht erneut lesen.
// Komponenten, um die es im Auftrag geht: per Pfad (components/<id>.js) oder per Name als eigenes Wort („Musik“)
export function componentsIn(root, prompt) {
  const read = p => { try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch { return null; } };
  const ids = new Set([...prompt.matchAll(/components\/([a-z0-9-]+)\.js/g)].map(m => m[1]).filter(id => id !== '_index'));
  for (const file of fs.readdirSync(path.join(root, 'components')).filter(n => /^[a-z0-9-]+\.js$/.test(n) && n !== '_index.js' && !n.endsWith('.tweaks.js'))) {
    const src = read(`components/${file}`) || '';
    const name = (src.match(/\bname:\s*'([^']+)'/) || [])[1];
    // als eigenes Wort (Buchstaben davor oder danach zählen nicht), ab 4 Zeichen, damit kurze Namen nicht zufällig treffen
    if (name && name.length >= 4 && new RegExp(`(?<!\\p{L})${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\p{L})`, 'u').test(prompt)) ids.add(file.slice(0, -3));
  }
  return [...ids];
}
export function buildContext(root, system, prompt) {
  const read = p => { try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch { return null; } };
  const block = (p, lang) => { const t = read(p); return t == null ? '' : `### ${p}\n\`\`\`${lang}\n${t.trim()}\n\`\`\`\n`; };
  const ids = componentsIn(root, prompt);
  let ls = '';
  try { const m = (read('feedback/leitsaetze.js') || '').match(/=\s*(\[[\s\S]*\]);?\s*$/); ls = JSON.parse(m[1]).filter(x => x.status === 'bestaetigt').map(x => `- ${x.id}: ${x.text}`).join('\n'); } catch {}
  let pref = '';
  try { const m = (read('feedback/praeferenzen.js') || '').match(/=\s*(\[[\s\S]*\]);/); pref = JSON.parse(m[1]).slice(-8).map(e => `- ${e.c}/${e.l} ${e.decision}${e.comment ? `: „${e.comment}“` : ''}`).join('\n'); } catch {}
  const list = fs.readdirSync(path.join(root, 'components')).filter(n => /^[a-z0-9-]+\.js$/.test(n) && n !== '_index.js' && !n.endsWith('.tweaks.js')).map(n => n.slice(0, -3));
  return `# Kontext (aktueller Stand – diese Dateien musst du nicht noch einmal lesen)
Komponenten im Projekt: ${list.join(', ')}.
${block(`systems/${system}/system.js`, 'js')}${block(`systems/${system}/system.css`, 'css')}${ls ? `### Bestätigte Leitsätze (wie Soll-Regeln)\n${ls}\n` : ''}${pref ? `### Letzte Entscheidungen zu Varianten\n${pref}\n` : ''}${ids.map(id => block(`components/${id}.js`, 'js') + block(`components/${id}.tweaks.js`, 'js')).join('')}`;
}

// onEvent({type:'step', code}) · ({type:'detail', text}) ; done → {type:'done', id, text, cost} | {type:'error', text}
export function createClaudeJob(prompt, { root, model, system = 'fabrik', figma = false, context = false, onEvent }) {
  onEvent({ type: 'meta', model: model || 'standard', context });
  const sys = `${context ? `${buildContext(root, system, prompt)}\n` : ''}${SYSTEM}\nAktives Regelwerk: systems/${system}/system.js (Werte, Regeln) und systems/${system}/system.css (Tokens, Typo-Klassen). Prüfe mit node tools/check.mjs <id> --system ${system}, Screenshots mit node tools/shot.mjs <id> --layouts --system=${system}.`;
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits',
    '--allowedTools', ...TOOLS, ...(figma ? FIGMA_TOOLS : []), '--append-system-prompt', sys];
  if (model) args.push('--model', model);
  const proc = spawn(BIN, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const pending = new Map();
  const touched = [];
  let buf = '', errTail = '', result = null, cancelled = false;

  const handle = msg => {
    const content = msg.message?.content;
    if (msg.type === 'assistant' && Array.isArray(content)) {
      for (const c of content) {
        if (c.type !== 'tool_use') continue;
        const s = stepFor(c.name, c.input || {}, root);
        if (!s) continue;
        pending.set(c.id, s);
        if (s.file) touched.push(s.file);
        if (s.files) touched.push(...s.files);
        onEvent({ type: 'step', code: s.code });
      }
    } else if (msg.type === 'user' && Array.isArray(content)) {
      for (const c of content) {
        if (c.type !== 'tool_result' || !pending.has(c.tool_use_id)) continue;
        const s = pending.get(c.tool_use_id);
        const text = typeof c.content === 'string' ? c.content : (c.content || []).map(x => x.text || '').join('\n');
        const d = detailFor(s.kind, text, c.is_error);
        if (d) onEvent({ type: 'detail', text: d });
      }
    } else if (msg.type === 'result') {
      result = msg;
    }
  };

  proc.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try { handle(JSON.parse(line)); } catch {}
    }
  });
  proc.stderr.on('data', d => { errTail = (errTail + d).slice(-600); });

  const done = new Promise(resolve => {
    proc.on('error', e => resolve({ type: 'error', text: `Claude Code ließ sich nicht starten: ${e.message}` }));
    proc.on('close', () => {
      if (cancelled) return resolve({ type: 'error', text: 'Abgebrochen.' });
      if (!result) return resolve({ type: 'error', text: errTail.trim() || 'Claude Code hat keine Antwort geliefert.' });
      if (result.is_error || result.subtype !== 'success') return resolve({ type: 'error', text: String(result.result || result.subtype) });
      const text = String(result.result || '');
      const m = text.match(/^ID:\s*([a-z0-9-]+)\s*$/im);
      const fromFiles = touched.map(f => f.match(/^components\/([a-z0-9-]+)\.js$/)?.[1]).filter(id => id && id !== '_index');
      const id = m && m[1] !== '-' ? m[1] : fromFiles[fromFiles.length - 1] || null;
      resolve({ type: 'done', id, text: text.replace(/^ID:.*$/im, '').trim(), cost: result.total_cost_usd, files: [...new Set(touched)].filter(p => p && !p.startsWith('..')) });
    });
  });

  return { done, cancel() { cancelled = true; proc.kill('SIGTERM'); } };
}

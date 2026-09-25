// Brücke zu Claude Code: startet `claude -p` im Projektordner und übersetzt die Ereignisse
// in kurze Arbeitsschritte für die Anzeige („Denkt nach …“) in der Fabrik.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

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
Arbeite strikt nach CLAUDE.md und den Regeln in factory/system.js. Lies components/<id>.tweaks.js, falls vorhanden: gesperrte Flächen (locks) nie verändern.
- Neue Komponente gewünscht: components/<id>.js mit drei Layouts anlegen und die id in components/_index.js eintragen.
- Änderung an einer bestehenden Komponente, einem Layout oder einer Regel: nur das Nötige ändern. Änderungen aus dem Bearbeiten-Modus (Auto-Layout) sind verbindlich: Reihenfolge, feste Größen und gap als Struktur im Code umsetzen (Markup/data, width/height, gap), nie mit absoluten Positionen oder translate; danach nicht mehr im Raster liegende Flächen ausgleichen.
- Danach immer: node tools/check.mjs <id> bis alles ✓ ist. Dann den Screenshot NEU erzeugen (node tools/shot.mjs <id> --layouts; PNGs in shots/ von vorher sind veraltet), ansehen und offensichtliche optische Fehler beheben.
- Zum Schluss höchstens zwei kurze Sätze auf Deutsch, was du gemacht hast. Letzte Zeile genau: ID: <id der betroffenen Komponente> (oder ID: - wenn keine).`;

const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash(node tools/check.mjs:*)', 'Bash(node tools/shot.mjs:*)'];

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
      if ((m = bash.match(/tools\/check\.mjs\s*([^|&;>]*)/))) return { code: `rules.check(${m[1].trim() ? `"${m[1].trim()}"` : ''})`, kind: 'check' };
      if ((m = bash.match(/tools\/shot\.mjs\s*([^|&;>]*)/))) return { code: `render.snapshot("${m[1].trim()}")`, kind: 'shot' };
      return { code: `shell("${bash.slice(0, 40)}")`, kind: 'shell' };
    case 'TodoWrite': return null;
    default: return { code: `${tool.toLowerCase()}()`, kind: 'other' };
  }
}

function detailFor(kind, text, isError) {
  if (isError) return 'abgelehnt';
  if (kind === 'check') {
    if (/Alles im Raster/.test(text)) return 'im Raster';
    const m = text.match(/(\d+) Verstöße/);
    return m ? `${m[1]} Verstöße` : 'geprüft';
  }
  if (kind === 'view') return 'angesehen';
  return null;
}

// onEvent({type:'step', code}) · ({type:'detail', text}) ; done → {type:'done', id, text, cost} | {type:'error', text}
export function createClaudeJob(prompt, { root, model, onEvent }) {
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits',
    '--allowedTools', ...TOOLS, '--append-system-prompt', SYSTEM];
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
      resolve({ type: 'done', id, text: text.replace(/^ID:.*$/im, '').trim(), cost: result.total_cost_usd });
    });
  });

  return { done, cancel() { cancelled = true; proc.kill('SIGTERM'); } };
}

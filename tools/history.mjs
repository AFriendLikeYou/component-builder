// Verlauf über Git: jede Änderung wird ein Commit, „Rückgängig“ ist ein Revert, „Wiederherstellen“ setzt einen alten Stand.
// Benutzt von tools/serve.mjs. Commits der Fabrik tragen ein Präfix, an dem die Oberfläche die Art erkennt.
import { execFileSync } from 'node:child_process';

const CLAUDE_TRAILER = 'Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>';
const KINDS = [
  ['Claude: ', 'claude'], ['Feinschliff: ', 'tweak'], ['Text: ', 'text'], ['Regeln: ', 'rules'],
  ['Rückgängig: ', 'undo'], ['Wiederhergestellt: ', 'restore'], ['Ausgangsstand', 'start'],
];

export function createHistory(root, { busy = () => false } = {}) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
  let enabled = false;
  try { enabled = git('rev-parse', '--is-inside-work-tree') === 'true'; } catch {}

  const changed = () => git('status', '--porcelain').split('\n').filter(Boolean).map(l => l.slice(3).replace(/^"|"$/g, ''));
  const reasons = new Set();
  let timer = null;

  function commitNow(message, { claude = false } = {}) {
    if (!enabled) return null;
    clearTimeout(timer);
    timer = null;
    const files = changed();
    if (!files.length) { reasons.clear(); return null; }
    const subject = message || [...reasons].slice(0, 3).join('; ') || `Geändert: ${files.slice(0, 4).join(', ')}${files.length > 4 ? ' …' : ''}`;
    reasons.clear();
    git('add', '-A');
    git('commit', '-q', '-m', subject.slice(0, 120), ...(claude ? ['-m', CLAUDE_TRAILER] : []));
    return subject;
  }

  // Viele kleine Schreibvorgänge (Feinschliff) zu einem Commit bündeln
  function schedule(reason, delay = 2000) {
    if (!enabled) return;
    if (reason) reasons.add(reason);
    clearTimeout(timer);
    timer = setTimeout(() => { if (busy()) return schedule(null, delay); try { commitNow(); } catch (e) { console.error('Verlauf:', e.message); } }, delay);
  }

  function list(n = 40) {
    if (!enabled) return [];
    const raw = git('log', `-n${n}`, '--date=iso-strict', '--name-only', '--pretty=format:%x1e%H%x1f%h%x1f%ad%x1f%s%x1f%b%x1d');
    const items = raw.split('\x1e').filter(s => s.trim()).map(chunk => {
      const [meta, files = ''] = chunk.split('\x1d');
      const [sha, short, when, subject, body] = meta.split('\x1f');
      const kind = (KINDS.find(([p]) => subject.startsWith(p)) || [null, 'extern'])[1];
      return { sha, short, when, subject, body: body.trim(), kind, files: files.split('\n').map(s => s.trim()).filter(Boolean) };
    });
    const reverted = new Set(items.flatMap(i => [...i.body.matchAll(/Macht ([0-9a-f]{40}) rückgängig/g)].map(m => m[1])));
    items.forEach(i => { i.undone = reverted.has(i.sha); });
    return items;
  }

  function undo() {
    commitNow();
    const target = list(200).find(i => !i.undone && i.kind !== 'undo' && i.kind !== 'start');
    if (!target) return { ok: false, error: 'Nichts mehr rückgängig zu machen.' };
    try {
      git('revert', '--no-edit', '--no-commit', target.sha);
      git('commit', '-q', '-m', `Rückgängig: ${target.subject}`.slice(0, 120), '-m', `Macht ${target.sha} rückgängig`);
      return { ok: true, subject: target.subject };
    } catch (e) {
      try { git('revert', '--abort'); } catch {}
      try { git('reset', '-q', '--hard', 'HEAD'); } catch {}
      return { ok: false, error: 'Das lässt sich nicht einzeln zurücknehmen, weil spätere Änderungen darauf aufbauen. Nimm „Wiederherstellen“ bei einem älteren Stand.' };
    }
  }

  function restore(sha) {
    if (!/^[0-9a-f]{7,40}$/.test(sha || '')) return { ok: false, error: 'Unbekannter Stand.' };
    commitNow();
    const item = list(200).find(i => i.sha.startsWith(sha));
    if (!item) return { ok: false, error: 'Unbekannter Stand.' };
    const added = git('diff', '--name-only', '--diff-filter=A', item.sha, 'HEAD').split('\n').filter(Boolean);
    git('checkout', item.sha, '--', '.');
    if (added.length) git('rm', '-q', '-f', '--', ...added);
    const subject = commitNow(`Wiederhergestellt: ${item.subject}`.slice(0, 120));
    return { ok: true, subject: subject || 'Keine Änderung – das ist schon der aktuelle Stand.' };
  }

  return { enabled, commitNow, schedule, list, undo, restore };
}

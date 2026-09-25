/* Component Factory
   Vermisst jede Komponente im Browser und erzeugt daraus die Schichten
   (Pixel, Flächen, Struktur, Schriften), den Prüfbericht und die vier Ansichten. */
(() => {
'use strict';

const S = window.SYSTEM;
let U = S.unit; // wird beim Anpassen der Regeln neu gesetzt
const SYS_ID = window.CF_SYSTEM_ID || 'fabrik';
const SYS_JS = `systems/${SYS_ID}/system.js`, SYS_CSS = `systems/${SYS_ID}/system.css`;
const GV = () => S.gridView || (U < 4 ? 4 : U); // Abstand der Rasterlinien in der Pixel-Schicht
const isSerif = f => /basker|tiemann|serif|georgia|times/i.test(f || '');
const Q = new URLSearchParams(location.search);
const CHECK = Q.has('check');
const STILL = CHECK || Q.has('still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const NOW = Q.get('now') ? new Date(Q.get('now')) : new Date();

const F = window.Factory = { components: [], byId: {}, loadErrors: [], media: [], bps: {}, live: null };

/* ---------- Hilfen ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad2 = n => String(n).padStart(2, '0');
const r1 = v => Math.round(v * 10) / 10;
const onStep = (v, step) => Math.abs(v - Math.round(v / step) * step) <= 0.5;
const onGrid = v => onStep(v, U);
const box = r => `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ß]+/g, ' ').trim();
const store = {
  get(k, d) { try { const v = localStorage.getItem('cf.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('cf.' + k, JSON.stringify(v)); } catch {} },
};

window.addEventListener('error', e => {
  const file = (e.filename || '').split('?')[0];
  if (file.includes('/components/')) F.loadErrors.push(`${file.split('/').pop()}: ${e.message} (Zeile ${e.lineno})`);
});

/* ---------- Registrieren und Laden ---------- */
F.register = def => {
  if (!def || !def.id || !Array.isArray(def.layouts) || !def.layouts.length) {
    F.loadErrors.push(`Ungültige Komponente ${def && def.id ? `„${def.id}“` : ''}: id und layouts[] sind Pflicht`);
    return;
  }
  if (F.byId[def.id]) { F.loadErrors.push(`Doppelte id „${def.id}“`); return; }
  def.name = def.name || def.id;
  def.data = def.data || {};
  def.layouts = def.layouts.map((l, i) => ({
    width: S.width, ...l, // padding fehlt = Inset aus den Regeln (live anpassbar)
    id: l.id || `l${i + 1}`, name: l.name || `Layout ${i + 1}`, index: i,
  }));
  F.components.push(def);
  F.byId[def.id] = def;
  if (def.css) {
    const st = document.createElement('style');
    st.dataset.component = def.id;
    st.textContent = `[data-c="${def.id}"] {\n${def.css}\n}`;
    document.head.appendChild(st);
  }
};

const addScript = src => new Promise(res => {
  const s = document.createElement('script');
  s.src = src;
  s.onload = () => res(true);
  s.onerror = () => res(false);
  document.head.appendChild(s);
});

F.load = async ids => {
  const bust = location.protocol === 'file:' ? `?v=${Date.now()}` : '';
  for (const id of ids) {
    const before = F.components.length;
    const ok = await addScript(`components/${id}.js${bust}`);
    if (!ok) F.loadErrors.push(`components/${id}.js fehlt`);
    else if (F.components.length === before && !F.loadErrors.some(e => e.startsWith(`${id}.js`))) F.loadErrors.push(`components/${id}.js ruft Factory.register nicht auf`);
    else await addScript(`components/${id}.tweaks.js${bust}`);
  }
  await addScript(`media/_media.js${bust}`);
  await addScript(`feedback/praeferenzen.js${bust}`);
  await addScript(`feedback/leitsaetze.js${bust}`);
  boot();
};

/* ---------- Medien ---------- */
const MEDIA_SOURCES = ['web', 'folder', 'own', 'none'];
let mediaSource = Q.get('media') || store.get('media', 'web');
let MEASURING = false;

function mediaPool() {
  if (mediaSource === 'own' && F.media.length) return F.media;
  if (mediaSource === 'folder' && window.MEDIA && window.MEDIA.length) {
    return window.MEDIA.map(src => ({ src, type: /\.(mp4|webm|mov|m4v)$/i.test(src) ? 'video' : 'image' }));
  }
  return null;
}

let webOK = true;
function probeWeb() {
  const img = new Image();
  img.onerror = () => {
    webOK = false;
    if (mediaSource !== 'web') return;
    mediaSource = 'none';
    renderMediaBtn();
    route(true);
  };
  img.src = 'https://picsum.photos/seed/cf-probe/4/4';
}

function placeholder(key) {
  const h = hash(key), a = h % 360, b = (a + 40 + (h >> 9) % 80) % 360;
  const x1 = 15 + (h >> 3) % 60, y1 = 10 + (h >> 7) % 50, x2 = 90 - (h >> 5) % 50;
  return `background-image:radial-gradient(90% 80% at ${x1}% ${y1}%,hsl(${a} 40% 80%) 0%,transparent 65%),radial-gradient(110% 90% at ${x2}% 100%,hsl(${b} 32% 58%) 0%,transparent 70%);background-color:hsl(${(a + 180) % 360} 16% 86%)`;
}

function makeMedia(c) {
  const base = hash(c.id);
  return (slot = 0, opt = {}) => {
    const key = `${c.id}-${slot}`;
    const attrs = `data-media class="cf-media${opt.class ? ' ' + esc(opt.class) : ''}" style="${placeholder(key)};${esc(opt.style || '')}"${opt.bleed ? ' data-bleed' : ''}${opt.area ? ` data-area="${esc(opt.area)}"` : ''}`;
    if (MEASURING || mediaSource === 'none') return `<div ${attrs}></div>`;
    const pool = mediaPool();
    let src, type = 'image';
    if (pool) ({ src, type } = pool[(base + slot) % pool.length]);
    else if (mediaSource === 'web') src = `https://picsum.photos/seed/${encodeURIComponent(key)}/640/640`;
    if (!src) return `<div ${attrs}></div>`;
    const inner = type === 'video'
      ? `<video src="${esc(src)}" autoplay muted loop playsinline></video>`
      : `<img src="${esc(src)}" alt="" decoding="async" onerror="this.remove()">`;
    return `<div ${attrs}>${inner}</div>`;
  };
}

/* ---------- Icons (Linien, 24er-Box) ---------- */
const ICONS = {
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/>',
  prev: '<path d="M18 6v12l-8.5-6z"/><path d="M6 6v12"/>',
  next: '<path d="M6 6v12l8.5-6z"/><path d="M18 6v12"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  'chevron-left': '<path d="m14.5 6-6 6 6 6"/>',
  'chevron-right': '<path d="m9.5 6 6 6-6 6"/>',
  'chevron-down': '<path d="m6 9.5 6 6 6-6"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M9 7h8v8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  refresh: '<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19 5v4h-4"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4.5M10 2.5h4"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  pin: '<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  heart: '<path d="M12 19.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z"/>',
  bookmark: '<path d="M7 4h10v16l-5-3.5L7 20z"/>',
  more: '<circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  cloud: '<path d="M7.5 18h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 6.6 11.1 3.5 3.5 0 0 0 7.5 18z"/>',
  rain: '<path d="M7.5 15h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 6.6 8.1 3.5 3.5 0 0 0 7.5 15z"/><path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2"/>',
  wind: '<path d="M4 9h10a2.5 2.5 0 1 0-2.5-2.5M4 13h14a2.5 2.5 0 1 1-2.5 2.5M4 17h7"/>',
  drop: '<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  image: '<rect x="4" y="4.5" width="16" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.6"/><path d="m5 18 5-5 3.5 3.5L16 14l3.5 3.5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
  shuffle: '<path d="M4 7h3.5c2 0 3 1 4.5 3.5S14.5 17 16.5 17H20M4 17h3.5c1.2 0 2-.4 2.8-1.2M13.7 8.2C14.5 7.4 15.3 7 16.5 7H20M17 4l3 3-3 3M17 14l3 3-3 3"/>',
  repeat: '<path d="M5 11V9a3 3 0 0 1 3-3h11M16 3l3 3-3 3M19 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3"/>',
  volume: '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  power: '<path d="M12 4v8"/><path d="M7.5 7a7 7 0 1 0 9 0"/>',
  plane: '<path d="M10.5 13.5 3.5 11l1.5-1.5 7 1 4.2-4.3a1.8 1.8 0 0 1 2.6 2.6L14.5 13l1 7-1.5 1.5-2.5-7"/>',
};
const icon = (name, size = 20) => `<svg class="icon" data-icon="${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.more}</svg>`;

/* ---------- Zeit ---------- */
function zoned(tz, locale = 'de-DE') {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit', day: 'numeric', month: 'numeric', year: 'numeric',
  }).formatToParts(NOW).map(x => [x.type, x.value]));
  const h = +p.hour, m = +p.minute, s = +p.second;
  const fmt = o => new Intl.DateTimeFormat(locale, { timeZone: tz, ...o }).format(NOW);
  return {
    h, m, s, day: +p.day, month: +p.month, year: +p.year,
    time: `${pad2(h)}:${pad2(m)}`,
    date: fmt({ weekday: 'short', day: 'numeric', month: 'short' }),
    weekday: fmt({ weekday: 'long' }),
    night: h < 7 || h >= 19,
  };
}

// Render-Bedingungen: Zustand (normal, hover, loading, empty, error) und Kartenbreite – für Zustände und Breakpoints
const RENDER = { state: null, width: null };
function withRender(opts, fn) {
  const keep = { ...RENDER };
  Object.assign(RENDER, opts);
  try { return fn(); } finally { Object.assign(RENDER, keep); }
}
const helpers = (c, l) => ({ media: makeMedia(c), icon, esc, pad2, zoned, now: NOW, S, state: RENDER.state || 'normal', width: RENDER.width || l?.width || S.width });

/* ---------- Karte rendern ---------- */
function renderInner(c, l) {
  try { return l.render(c.data, helpers(c, l)); }
  catch (e) { console.error(e); return `<div class="cf-error">${esc(c.id)} / ${esc(l.id)}: ${esc(e.message)}</div>`; }
}
function cardHTML(c, l) {
  const dark = l.dark ?? c.dark;
  const tw = F.tw[c.id]?.[l.id];
  const w = RENDER.width || l.width;
  const H = tw?.height || (typeof l.height === 'function' ? l.height(w) : l.height);
  const h = H ? `height:${H}px;` : '';
  const st = RENDER.state && RENDER.state !== 'normal' ? ` is-state-${RENDER.state}${RENDER.state === 'hover' ? ' is-hover' : ''}` : '';
  return `<div class="cf-card${dark ? ' is-dark' : ''}${st}" data-c="${esc(c.id)}" data-l="${esc(l.id)}" style="width:${w}px;${h}padding:${l.padding ?? S.inset}px">${applyTweaks(renderInner(c, l), tw)}</div>`;
}

/* ---------- Vermessen ---------- */
const measureCtx = document.createElement('canvas').getContext('2d');
const ROLES = ['Titel', 'Text', 'Detail'];
const WNAME = { 500: 'medium', 600: 'semibold', 700: 'bold' };
const LOREM = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore'.split(' ');
const radiiLabel = () => S.innerRadii.map(r => r === 'pill' ? 'Pille' : r).join(', ');
const inScale = s => S.typeScale.some(t => Math.abs(t - s) <= 0.5);
const shortFam = f => f.replace(/^Libre /, '');
const famCSS = f => `"${f}", ${isSerif(f) ? 'serif' : 'sans-serif'}`;

function alpha(col) {
  if (!col || col === 'transparent') return 0;
  const m = col.match(/\(([^)]+)\)/);
  if (!m) return 1;
  const p = m[1].split(/[\s,/]+/).filter(Boolean);
  const a = p.length > 3 ? p[p.length - 1] : '1';
  return a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
}
function parseColor(v) {
  if (!v || v === 'transparent' || v === 'none' || v.startsWith('url')) return null;
  let m = v.match(/^rgba?\(([^)]+)\)$/), k = 1;
  if (!m) { m = v.match(/^color\(srgb ([^)]+)\)$/); k = 255; }
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
  return { rgb: p.slice(0, 3).map(x => Math.round(x * k)), a: p.length > 3 ? p[3] : 1 };
}
const hexOf = rgb => `#${rgb.map(x => x.toString(16).padStart(2, '0')).join('')}`;
const ACCENT_FAMILY = { '--c-accent': 'Blau', '--c-accent-soft': 'Blau', '--c-warm': 'Warm', '--c-warm-soft': 'Warm', '--c-highlight': 'Gelb' };
let PALETTE = null;
function tokenPalette() {
  if (PALETTE) return PALETTE;
  const probe = document.createElement('i');
  document.body.appendChild(probe);
  const names = new Set();
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules) if (r.selectorText === ':root') for (const p of r.style) if ((S.tokenPrefixes || ['--c-']).some(x => p.startsWith(x))) names.add(p);
  }
  PALETTE = [...names].map(name => { probe.style.color = `var(${name})`; return { name, ...parseColor(getComputedStyle(probe).color) }; }).filter(t => t.rgb);
  probe.remove();
  return PALETTE;
}
function matchToken(c) {
  const d = t => Math.hypot(t.rgb[0] - c.rgb[0], t.rgb[1] - c.rgb[1], t.rgb[2] - c.rgb[2]);
  // Bei gleichem Farbton gewinnt der Token mit passender Deckkraft (Weiß 100 % statt Weiß 40 %)
  const score = t => d(t) + Math.abs((t.a ?? 1) - (c.a ?? 1)) * 2;
  const best = tokenPalette().reduce((b, t) => (!b || score(t) < score(b) ? t : b), null);
  if (best && d(best) <= 3) return best.name;
  if (c.a < 1 && (c.rgb.every(x => x === 0) || c.rgb.every(x => x === 255))) return 'neutral'; // Schwarz/Weiß mit Transparenz für Linien und Schatten
  return null;
}

function radiusOk(r, w, h) {
  if (S.innerRadii.includes(r) || S.innerRadii.some(x => typeof x === 'number' && Math.abs(x - r) <= 0.5)) return true;
  return S.innerRadii.includes('pill') && r >= Math.min(w, h) / 2 - 0.5;
}
function radiusPx(el, w, h) {
  const v = getComputedStyle(el).borderTopLeftRadius.split(" ")[0];
  const n = parseFloat(v) || 0;
  return v.endsWith("%") ? n / 100 * Math.min(w, h) : n;
}
function normFamily(ff) { return (ff.split(',')[0] || '').trim().replace(/^["']|["']$/g, ''); }

function mergeLines(rs) {
  const out = [];
  rs.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const r of rs) {
    const L = out.find(o => Math.abs((o.y + o.h / 2) - (r.y + r.h / 2)) < Math.max(2, Math.min(o.h, r.h) / 2));
    if (L) {
      const x2 = Math.max(L.x + L.w, r.x + r.w), y2 = Math.max(L.y + L.h, r.y + r.h);
      L.x = Math.min(L.x, r.x); L.y = Math.min(L.y, r.y); L.w = x2 - L.x; L.h = y2 - L.y;
    } else out.push({ ...r });
  }
  return out.map(o => ({ x: r1(o.x), y: r1(o.y), w: r1(o.w), h: r1(o.h) }));
}

function fitLabel(first, w, font, offset) {
  measureCtx.font = font;
  const width = s => measureCtx.measureText(s).width;
  let s = first || LOREM[offset % LOREM.length];
  if (width(s) > w) {
    let t = s;
    while (t.length > 1 && width(t + '…') > w) t = t.slice(0, -1);
    return t.length < s.length && t.length > 1 ? t + '…' : t;
  }
  for (let i = first ? 0 : offset + 1; ; i++) {
    const n = `${s} ${LOREM[i % LOREM.length]}`;
    if (width(n) > w * 0.72 || i > offset + 14) break;
    s = n;
  }
  return s;
}

/* ---------- Bausteine (atoms in system.js) ---------- */
// Beispiel eines Bausteins als HTML: {v} = Variantenklassen, {icon:name:größe} = Icon
const atomSample = (a, v = '') => String(a.sample || `<span class="${a.match.replace(/^\./, '')} {v}">${esc(a.name)}</span>`)
  .replace(/\{v\}/g, v).replace(/\{icon:([a-z-]+)(?::(\d+))?\}/g, (m, n, z) => icon(n, +z || 20));
const atomById = id => (S.atoms || []).find(a => a.id === id);
const atomOf = el => (S.atoms || []).find(a => el.matches(a.match));
const NOISE_CLASS = /^(t-\d+|w-\d+|ink-\d|num|clip|tight|serif|row|stack|grow|between|g-\d+|is-.+|sm|lg|xl|solid)$/;
const selOf = el => { const k = [...el.classList].find(x => !NOISE_CLASS.test(x)); return `${el.tagName.toLowerCase()}${k ? `.${k}` : ''}`; };
const labelOf = el => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) || el.tagName.toLowerCase();
// Erlaubte Höhen je Baustein, gemessen an den Beispielen (Standard und jede Variante)
let ATOM_SIZES = null;
function atomSizes() {
  if (ATOM_SIZES) return ATOM_SIZES;
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-9999px;top:0';
  host.innerHTML = `<div class="cf-card" style="width:352px;padding:24px">${(S.atoms || []).map(a => ['', ...Object.keys(a.variants || {})].map(v => `<div data-atom="${esc(a.id)}">${atomSample(a, v)}</div>`).join('')).join('')}</div>`;
  document.body.appendChild(host);
  ATOM_SIZES = {};
  host.querySelectorAll('[data-atom]').forEach(d => { const el = d.firstElementChild; if (el) (ATOM_SIZES[d.dataset.atom] ||= new Set()).add(r1(el.getBoundingClientRect().height)); });
  host.remove();
  return ATOM_SIZES;
}
// Welcher Baustein passt zu einem Eigenbau?
function suggestAtom(el) {
  const role = el.getAttribute('role');
  if (role === 'checkbox' || el.hasAttribute('aria-checked')) return atomById('check');
  if (role === 'switch' || el.hasAttribute('aria-pressed')) return atomById('toggle');
  const hasText = [el, ...el.querySelectorAll('*')].some(k => !(k instanceof SVGElement) && [...k.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim()));
  if (!hasText) return atomById('btn-round');
  return alpha(getComputedStyle(el).backgroundColor) > .04 ? atomById('btn-pill') : atomById('btn-text');
}

function measure(c, l, host) {
  MEASURING = true;
  host.innerHTML = cardHTML(c, l);
  MEASURING = false;
  const card = host.firstElementChild;
  const cb = card.getBoundingClientRect();
  const rel = r => ({ x: r1(r.left - cb.left), y: r1(r.top - cb.top), w: r1(r.width), h: r1(r.height) });
  const W = r1(cb.width), H = r1(cb.height);
  const bp = {
    c: c.id, l: l.id, name: c.name, lname: l.name, w: W, h: H,
    areas: [], texts: [], media: [], controls: [], icons: [], graphics: [], fills: [], violations: [],
  };
  const V = (rule, msg) => bp.violations.push({ rule, msg });
  const err = card.querySelector('.cf-error');
  if (err) V('error', err.textContent);
  if (!l.height) V('height', `Layout „${l.id}“ hat keine feste height (gemessen ${H} px)`);
  if (!onGrid(W) || !onGrid(H)) V('card', `Karte ${W} × ${H} liegt nicht im ${U}er-Raster`);
  if (card.scrollHeight > card.clientHeight + 1 || card.scrollWidth > card.clientWidth + 1) {
    V('overflow', `Inhalt läuft über: ${card.scrollWidth} × ${card.scrollHeight} statt ${W} × ${H}`);
  }

  // Flächen
  card.querySelectorAll('[data-area]').forEach(el => {
    const [role, name] = el.dataset.area.split(':');
    const r = rel(el.getBoundingClientRect());
    const a = { role: S.areaRoles.includes(role) ? role : 'meta', name: el.dataset.area, ...r, r: radiusPx(el, r.w, r.h), bleed: el.hasAttribute('data-bleed') };
    const label = `„${el.dataset.area}“`;
    if (!S.areaRoles.includes(role)) V('role', `Fläche ${label}: Rolle „${role}“ unbekannt (erlaubt: ${S.areaRoles.join(', ')})`);
    const off = ['x', 'y', 'w', 'h'].filter(k => !onGrid(a[k]));
    if (off.length) { a.off = true; V('grid', `Fläche ${label} liegt nicht im ${U}er-Raster (${off.map(k => `${k} ${a[k]}`).join(', ')})`); }
    if (!a.bleed) {
      const I = S.inset;
      if (a.x < I - .5 || a.y < I - .5 || a.x + a.w > W - I + .5 || a.y + a.h > H - I + .5) {
        a.out = true;
        V('inset', `Fläche ${label} (${a.x}, ${a.y}, ${a.w} × ${a.h}) ragt in den Innenabstand von ${I} px – randabfallend nur mit data-bleed`);
      }
    }
    if (!radiusOk(a.r, a.w, a.h)) V('radius', `Fläche ${label}: Radius ${a.r} px (erlaubt: ${radiiLabel()})`);
    bp.areas.push(a);
  });
  if (!bp.areas.length) V('areas', 'Keine Flächen markiert – jede Gruppe braucht data-area="rolle:name"');

  // Medien, Bedienelemente, Icons, Grafiken, Flächenfüllungen
  card.querySelectorAll('[data-media], img, video').forEach(el => {
    if (el.parentElement.closest('[data-media]')) return;
    const r = rel(el.getBoundingClientRect());
    if (r.w < 1 || r.h < 1) return;
    const rad = radiusPx(el, r.w, r.h);
    bp.media.push({ ...r, r: Math.min(rad, r.w / 2, r.h / 2) });
    if (!radiusOk(rad, r.w, r.h)) V('radius', `Medium ${r.w} × ${r.h}: Radius ${rad} px (erlaubt: ${radiiLabel()})`);
  });
  const CONTROL = 'button, input, select, [data-control], [role="button"]';
  card.querySelectorAll(CONTROL).forEach(el => {
    if (el.parentElement.closest(CONTROL)) return;
    const r = rel(el.getBoundingClientRect());
    if (r.w < 1) return;
    bp.controls.push({ ...r, r: Math.min(radiusPx(el, r.w, r.h), r.w / 2, r.h / 2) });
    const min = S.minTarget || 0;
    if (min && (r.w < min - .5 || r.h < min - .5)) {
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) || el.tagName.toLowerCase();
      V('target', `Bedienelement „${label}“ ist ${Math.round(r.w)} × ${Math.round(r.h)} px (mindestens ${min} × ${min})`);
    }
  });
  card.querySelectorAll('svg').forEach(el => {
    if (el.parentElement.closest('svg') || el.closest('[data-media]') || el.closest('.cf-error')) return;
    const r = rel(el.getBoundingClientRect());
    if (r.w < 1) return;
    if (el.classList.contains('icon')) { if (!el.closest(CONTROL)) bp.icons.push({ ...r }); }
    else bp.graphics.push({ ...r, round: Math.abs(r.w - r.h) < 2 });
  });
  for (const el of card.querySelectorAll('*')) {
    if (el instanceof SVGElement || el.closest('[data-media]') || el.matches(CONTROL) || el.closest('.cf-error')) continue;
    const cs = getComputedStyle(el);
    const br = el.getBoundingClientRect();
    if (br.width < 1 || br.height < 1) continue;
    const r = rel(br);
    if (alpha(cs.backgroundColor) > .04 || cs.backgroundImage !== 'none') {
      bp.fills.push({ ...r, r: Math.min(radiusPx(el, r.w, r.h), r.w / 2, r.h / 2), kind: 'fill' });
    }
    for (const side of ['Top', 'Bottom', 'Left', 'Right']) {
      const bw = parseFloat(cs[`border${side}Width`]);
      if (bw >= 1 && cs[`border${side}Style`] !== 'none' && alpha(cs[`border${side}Color`]) > .04) {
        const line = side === 'Top' ? { x: r.x, y: r.y, w: r.w, h: bw } : side === 'Bottom' ? { x: r.x, y: r1(r.y + r.h - bw), w: r.w, h: bw }
          : side === 'Left' ? { x: r.x, y: r.y, w: bw, h: r.h } : { x: r1(r.x + r.w - bw), y: r.y, w: bw, h: r.h };
        bp.fills.push({ ...line, r: 0, kind: 'line' });
      }
    }
  }

  // Bausteine (R12): Bedienelemente, Chips und Balken aus den Bausteinen, Icons aus dem Icon-Satz
  bp.atomUse = []; bp.own = [];
  if (S.atoms?.length) {
    const sel = S.atoms.map(a => a.match).join(', '), CTL = `${CONTROL}, [role="checkbox"], [role="switch"]`;
    const sizes = atomSizes();
    const own = (kind, el, r, msg, suggest) => {
      if (bp.own.some(o => o.msg === msg)) return;
      bp.own.push({ kind, sel: selOf(el), label: labelOf(el), w: Math.round(r.w), h: Math.round(r.h), suggest: suggest || null, msg, html: el.outerHTML.slice(0, 4000) });
      V('atoms', msg);
    };
    for (const el of card.querySelectorAll(`${CTL}, ${sel}`)) {
      if (el.closest('.cf-error')) continue;
      const r = rel(el.getBoundingClientRect());
      if (r.w < 1 || r.h < 1) continue;
      const a = atomOf(el);
      if (a) {
        bp.atomUse.push({ atom: a.id, vars: Object.keys(a.variants || {}).filter(v => el.classList.contains(v)) });
        const ok = sizes[a.id];
        if (a.control !== false && ok?.size && ![...ok].some(x => Math.abs(x - r.h) < .6)) own('size', el, r, `${a.name} „${labelOf(el)}“ ist ${Math.round(r.h)} px hoch – der Baustein kennt ${[...ok].sort((p, q) => p - q).join(', ')} px`, a.id);
        continue;
      }
      if (el.parentElement.closest(`${CTL}, ${sel}`)) continue;
      const sug = suggestAtom(el);
      own('control', el, r, `Eigenbau „${labelOf(el)}“ (${selOf(el)}, ${Math.round(r.w)} × ${Math.round(r.h)}) – nimm ${sug ? `${sug.name} (${sug.match})` : 'einen Baustein'}`, sug?.id);
    }
    // Fortschrittsbalken ohne Baustein: flacher Balken, links darin ein gefüllter kürzerer Teil
    for (const el of card.querySelectorAll('div, span, i')) {
      if (el.children.length !== 1 || el.closest(`[data-media], .cf-error, ${sel}`)) continue;
      const kid = el.firstElementChild;
      const b = el.getBoundingClientRect(), k = kid.getBoundingClientRect();
      if (b.height < 2 || b.height > 8 || b.width < 40 || k.width >= b.width - 1 || Math.abs(k.height - b.height) > 1 || Math.abs(k.left - b.left) > 1) continue;
      if (alpha(getComputedStyle(el).backgroundColor) < .04 || alpha(getComputedStyle(kid).backgroundColor) < .04) continue;
      const r = rel(b), p = atomById('progress');
      own('progress', el, r, `Eigenbau Fortschritt (${selOf(el)}, ${Math.round(r.w)} × ${Math.round(r.h)}) – nimm ${p ? `${p.name} (${p.match})` : 'einen Baustein'}`, p?.id);
    }
    for (const el of card.querySelectorAll('svg.icon')) {
      const n = el.dataset.icon;
      if (n && ICONS[n]) continue;
      own('icon', el, rel(el.getBoundingClientRect()), `Icon „${n || 'ohne Namen'}“ ist nicht im Icon-Satz – über h.icon nehmen oder in den Satz aufnehmen`, null);
    }
  }

  // Abstände aus der Skala: gap aller Flex/Grid-Container, padding und margin der Flächen und ihrer Container
  if (S.rules.some(r => r.checks.includes('spacing'))) {
    const scale = new Set([0, ...(S.spacing || [])]);
    const bad = new Map();
    for (const el of card.querySelectorAll('*')) {
      if (el instanceof SVGElement || el.closest('[data-media], .cf-error')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'inline' || cs.display === 'none') continue;
      const vals = [];
      if (/flex|grid/.test(cs.display)) vals.push(['gap', cs.rowGap], ['gap', cs.columnGap]);
      if (el.hasAttribute('data-area') || [...el.children].some(k => k.hasAttribute && k.hasAttribute('data-area'))) {
        for (const sd of ['Top', 'Right', 'Bottom', 'Left']) vals.push(['padding', cs[`padding${sd}`]], ['margin', cs[`margin${sd}`]]);
      }
      for (const [kind, v] of vals) {
        if (!v || v === 'normal' || v === 'auto') continue;
        const n = Math.abs(r1(parseFloat(v)));
        if (!Number.isFinite(n) || scale.has(n)) continue;
        const key = `${kind} ${n}`;
        if (!bad.has(key)) bad.set(key, el.dataset.area ? `„${el.dataset.area}“` : el.classList[0] ? `.${el.classList[0]}` : el.tagName.toLowerCase());
      }
    }
    [...bad].slice(0, 4).forEach(([k, where]) => V('spacing', `${k[0].toUpperCase()}${k.slice(1)} px in ${where} ist nicht in der Skala (${S.spacing.join(', ')})`));
    if (bad.size > 4) V('spacing', `… und ${bad.size - 4} weitere Abstände außerhalb der Skala`);
  }

  // Farben (R7): nur Tokens (auch mit Transparenz), höchstens eine Akzentfamilie
  const colors = new Map();
  const note = (v, where) => { const c = parseColor(v); if (!c || c.a < .02) return; const k = c.rgb.join(); if (!colors.has(k)) colors.set(k, { ...c, where }); };
  const SHAPES = 'circle, rect, path, polygon, ellipse, text';
  for (const el of [card, ...card.querySelectorAll('*')]) {
    if (el.closest('[data-media], .cf-error')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el instanceof SVGElement) {
      if (el.matches(SHAPES)) note(cs.fill, 'SVG-Fläche');
      if (el.matches('line, polyline, ' + SHAPES) && cs.stroke !== 'none') note(cs.stroke, 'SVG-Linie');
      continue;
    }
    if ([...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) note(cs.color, 'Text');
    note(cs.backgroundColor, 'Fläche');
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs[`border${side}Width`]) >= 1 && cs[`border${side}Style`] !== 'none') note(cs[`border${side}Color`], 'Rahmen');
  }
  const accentFams = new Set(), offToken = [];
  bp.colors = [];
  const famOf = t => { const fams = S.accentFamilies || null; if (!fams) return ACCENT_FAMILY[t]; return Object.keys(fams).find(k => fams[k].includes(t)); };
  colors.forEach(c => { const t = matchToken(c); bp.colors.push({ hex: hexOf(c.rgb), a: c.a, where: c.where, token: t }); if (!t) offToken.push(c); else if (famOf(t)) accentFams.add(famOf(t)); });
  offToken.slice(0, 4).forEach(c => V('color', `Farbe ${hexOf(c.rgb)}${c.a < 1 ? ` (${Math.round(c.a * 100)} %)` : ''} ist kein Token (${c.where}) – nimm eine --c-*-Farbe`));
  if (offToken.length > 4) V('color', `… und ${offToken.length - 4} weitere Farben ohne Token`);
  if (accentFams.size > 1) V('accent', `${accentFams.size} Akzentfarben (${[...accentFams].join(', ')}) – erlaubt ist eine pro Komponente`);
  bp.accents = [...accentFams];
  // Keine dunklen Flächen (nur wenn das Regelwerk es verlangt)
  const bgc = parseColor(getComputedStyle(card).backgroundColor);
  if (bgc && bgc.a > .5) { const lum = (.2126 * bgc.rgb[0] + .7152 * bgc.rgb[1] + .0722 * bgc.rgb[2]) / 255; if (lum < .3) V('dark', `Dunkle Kartenfläche ${hexOf(bgc.rgb)} – helle Flächen, gedeckte Verläufe statt dunkler Bühnen`); }

  // Texte
  const byEl = new Map();
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode;
    const el = t.parentElement;
    if (!t.nodeValue.trim() || !el || el.closest('style, script, .cf-error')) continue;
    if (!byEl.has(el)) byEl.set(el, []);
    byEl.get(el).push(t);
  }
  for (const [el, nodes] of byEl) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
    const svg = el instanceof SVGElement;
    let scale = 1, rects = [];
    if (svg) {
      const m = el.getScreenCTM();
      scale = m ? Math.hypot(m.a, m.b) : 1;
      rects = [el.getBoundingClientRect()];
    } else {
      for (const n of nodes) { const rg = document.createRange(); rg.selectNodeContents(n); rects.push(...rg.getClientRects()); }
    }
    const eb = el.getBoundingClientRect();
    if (!svg) {
      const txt = nodes.map(n => n.nodeValue).join('').trim().slice(0, 28);
      const intentional = cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none');
      const hidden = /hidden|clip/.test(cs.overflowX + cs.overflowY);
      const over = cs.display !== 'inline' && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
      // sichtbarer Teil: durch Eltern mit overflow != visible begrenzt (z. B. .clip) – nur echter Überstand zählt
      let clipBox = { left: -1e9, right: 1e9, top: -1e9, bottom: 1e9 };
      for (let p = el; p && p !== card; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (/hidden|clip|auto|scroll/.test(ps.overflowX + ps.overflowY)) { const b = p.getBoundingClientRect(); clipBox = { left: Math.max(clipBox.left, b.left), right: Math.min(clipBox.right, b.right), top: Math.max(clipBox.top, b.top), bottom: Math.min(clipBox.bottom, b.bottom) }; }
      }
      const spill = rects.some(r => Math.min(r.right, clipBox.right) > cb.right + .5 || Math.max(r.left, clipBox.left) < cb.left - .5 || Math.min(r.bottom, clipBox.bottom) > cb.bottom + .5);
      if (spill) V('clip', `Text „${txt}“ ragt aus der Karte`);
      else if (hidden && over && !intentional) V('clip', `Text „${txt}“ wird hart abgeschnitten – kürzen oder bewusst mit .clip`);
      if (intentional && over) bp.truncated = (bp.truncated || 0) + 1;
    }
    rects = rects.map(r => {
      const x1 = Math.max(r.left, eb.left, cb.left), x2 = Math.min(r.right, svg ? r.right : eb.right, cb.right);
      const y1 = Math.max(r.top, cb.top), y2 = Math.min(r.bottom, cb.bottom);
      return x2 - x1 > .5 && y2 - y1 > .5 ? rel({ left: x1, top: y1, width: x2 - x1, height: y2 - y1 }) : null;
    }).filter(Boolean);
    if (!rects.length) continue;
    const lhRaw = cs.lineHeight === 'normal' ? null : parseFloat(cs.lineHeight);
    bp.texts.push({
      family: normFamily(cs.fontFamily),
      size: r1(parseFloat(cs.fontSize) * scale),
      weight: parseInt(cs.fontWeight, 10) || 400,
      lh: lhRaw == null ? null : r1(lhRaw * scale),
      italic: cs.fontStyle === 'italic',
      svg,
      custom: el.closest('[data-role]')?.dataset.role || null,
      area: el.closest('[data-area]')?.dataset.area || null,
      text: nodes.map(n => n.nodeValue).join('').trim().slice(0, 48),
      lines: mergeLines(rects),
    });
  }

  // Typografie zählen
  const T = bp.texts;
  const sizes = [...new Set(T.map(t => t.size))].sort((a, b) => b - a);
  const weights = [...new Set(T.map(t => t.weight))].sort((a, b) => a - b);
  const families = [...new Set(T.map(t => t.family))];
  const styleMap = new Map();
  for (const t of T) {
    const key = `${t.family}|${t.size}|${t.weight}`;
    if (!styleMap.has(key)) styleMap.set(key, { family: t.family, size: t.size, weight: t.weight, count: 0, custom: t.custom });
    styleMap.get(key).count++;
  }
  const styles = [...styleMap.values()].sort((a, b) => b.size - a.size || b.weight - a.weight);
  for (const s of styles) {
    const rank = sizes.indexOf(s.size);
    const same = styles.filter(x => x.size === s.size);
    let role = ROLES[rank] || `Größe ${rank + 1}`;
    if (same.length > 1) {
      if (s.weight > Math.min(...same.map(x => x.weight))) role += ` ${WNAME[s.weight] || s.weight}`;
      if (new Set(same.map(x => x.family)).size > 1 && isSerif(s.family)) role += ' serif';
    }
    s.role = s.custom || role;
    s.bad = !S.families[s.family] || !inScale(s.size);
  }
  let off = 0;
  for (const t of T) {
    t.role = t.custom || styles.find(s => s.family === t.family && s.size === t.size && s.weight === t.weight).role;
    const font = `${t.italic ? 'italic ' : ''}${t.weight} ${t.size}px ${famCSS(t.family)}`;
    t.lines.forEach((ln, i) => { ln.label = fitLabel(i === 0 ? t.role : null, ln.w, font, off + i * 3); });
    off += 2;
  }
  bp.type = { sizes, weights, families, styles };

  const L = S.limits;
  families.filter(f => !S.families[f]).forEach(f => V('family', `Familie „${f}“ ist nicht erlaubt (erlaubt: ${Object.keys(S.families).join(', ')})`));
  if (families.length > L.families) V('families', `${families.length} Familien (max. ${L.families})`);
  if (sizes.length > L.sizes) V('sizes', `${sizes.length} Schriftgrößen: ${sizes.join(', ')} px (max. ${L.sizes})`);
  if (weights.length > L.weights) V('weights', `${weights.length} Schnitte: ${weights.join(', ')} (max. ${L.weights})`);
  sizes.filter(s => !inScale(s)).forEach(s => V('scale', `Schriftgröße ${s} px ist nicht in der Skala (${S.typeScale.join(', ')})`));
  const badLh = new Map();
  const lhOk = t => t.lh != null && (S.lineHeightRatios
    ? S.lineHeightRatios.some(q => Math.abs(t.lh - t.size * q) <= .6)
    : onStep(t.lh, S.lineHeightStep));
  T.filter(t => !t.svg && !lhOk(t)).forEach(t => { if (!badLh.has(t.lh)) badLh.set(t.lh, t); });
  badLh.forEach((t, lh) => V('leading', `Zeilenhöhe ${lh == null ? 'normal' : lh + ' px'} bei „${t.text.slice(0, 28)}“ (${S.lineHeightRatios ? `Faktor ${S.lineHeightRatios.join(' · ')} der Größe` : `Vielfache von ${S.lineHeightStep}`})`));
  // Überschriften-Schrift nur für Überschriften
  if (S.headline) T.filter(t => t.family === S.headline.family && t.size < S.headline.min).forEach(t => V('headline', `„${t.text.slice(0, 24)}“ in ${t.family} ${t.size} px – diese Schrift erst ab ${S.headline.min} px (Überschriften)`));

  for (const [name, r] of Object.entries(F.tw[c.id]?.[l.id]?.locks || {})) {
    const a = bp.areas.find(x => x.name === name);
    if (!a) V('lock', `Gesperrte Fläche „${name}“ fehlt`);
    else if (['x', 'y', 'w', 'h'].some(k => Math.abs(a[k] - r[k]) > .5)) V('lock', `Gesperrte Fläche „${name}“ wurde verändert: war ${r.x}, ${r.y} · ${r.w} × ${r.h}, ist ${a.x}, ${a.y} · ${a.w} × ${a.h}`);
  }

  // Nur zählen, was das aktive Regelwerk als Regel führt (Renderfehler zählen immer)
  const active = new Set(['error', ...S.rules.flatMap(r => r.checks)]);
  bp.findings = bp.violations.filter(v => active.has(v.rule));
  classify(bp);
  return bp;
}

// Befunde einteilen: Muss-Regel → Verstoß, Soll-Regel → Hinweis, bewusst akzeptiert → Ausnahme (mit Grund)
const ruleOf = code => S.rules.find(r => r.checks.includes(code));
const exceptionsOf = (cid, lid) => (F.tw[cid]?.[lid]?.exceptions || []).filter(e => !e.system || e.system === SYS_ID);
function classify(bp) {
  const ex = exceptionsOf(bp.c, bp.l);
  bp.violations = []; bp.warnings = []; bp.accepted = [];
  for (const v of bp.findings || []) {
    const r = ruleOf(v.rule);
    const e = ex.find(x => x.rule === v.rule && x.msg === v.msg);
    if (e) bp.accepted.push({ ...v, rid: r?.id, reason: e.reason });
    else (r?.level === 'soll' ? bp.warnings : bp.violations).push({ ...v, rid: r?.id });
  }
  bp.ok = bp.violations.length === 0;
}

function measureAll() {
  const host = document.createElement('div');
  host.id = 'cf-measure';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  F.bps = {};
  for (const c of F.components) for (const l of c.layouts) F.bps[`${c.id}/${l.id}`] = measure(c, l, host);
  host.remove();
  consistencyPass();
}
const bpOf = (c, l) => F.bps[`${c.id}/${l.id}`];

/* ---------- Einheitlichkeit über alle Komponenten (R11) ---------- */
// Maßstab ist die Mehrheit: gleicher Textstil in der Kopfzeile (text:kopf), gleicher Abstand zum Inhalt darunter.
function consistencyPass() {
  const all = Object.values(F.bps);
  all.forEach(b => { b.findings = (b.findings || []).filter(v => v.rule !== 'consistency'); });
  if (!S.rules.some(r => r.checks.includes('consistency'))) { all.forEach(classify); F.consistency = null; return; }
  const heads = [];
  for (const b of all) {
    const kopf = b.areas.find(a => a.name === 'text:kopf');
    if (!kopf) continue;
    const title = b.texts.find(t => t.area === 'text:kopf');
    const inside = a => a.x >= kopf.x - .5 && a.y >= kopf.y - .5 && a.x + a.w <= kopf.x + kopf.w + .5 && a.y + a.h <= kopf.y + kopf.h + .5;
    const below = b.areas.filter(a => a !== kopf && !inside(a) && a.y >= kopf.y + kopf.h - .5 && a.x < kopf.x + kopf.w && a.x + a.w > kopf.x).sort((p, q) => p.y - q.y)[0];
    heads.push({
      b,
      style: title ? `${title.family}|${title.size}|${title.weight}` : null,
      label: title ? `${shortFam(title.family)} ${title.size} · ${title.weight}` : null,
      gap: below ? r1(below.y - (kopf.y + kopf.h)) : null,
    });
  }
  const major = key => {
    const m = new Map();
    heads.forEach(h => { if (h[key] != null) m.set(h[key], (m.get(h[key]) || 0) + 1); });
    const n = heads.filter(h => h[key] != null).length;
    const best = [...m].sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= 3 && best[1] > n / 2 ? { value: best[0], count: best[1], of: n } : null;
  };
  const ms = major('style'), mg = major('gap');
  const msLabel = ms && heads.find(h => h.style === ms.value).label;
  heads.forEach(h => {
    if (ms && h.style && h.style !== ms.value) h.b.findings.push({ rule: 'consistency', msg: `Kopfzeile in ${h.label}, in den meisten Komponenten ${msLabel}` });
    if (mg && h.gap != null && h.gap !== mg.value) h.b.findings.push({ rule: 'consistency', msg: `Abstand unter der Kopfzeile ${h.gap} px, in den meisten Komponenten ${mg.value} px` });
  });
  all.forEach(classify);
  F.consistency = { style: ms && { label: msLabel, count: ms.count, of: ms.of }, gap: mg, heads: heads.length };
}

/* ---------- Schichten ---------- */
let UID = 0;
function gridSVG(bp, { faint = false, anim = false } = {}) {
  const W = bp.w, H = bp.h, I = S.inset, R = S.radius, id = `cfg${++UID}`, G = GV();
  let lines = '';
  for (let x = G, i = 0; x < W; x += G, i++) lines += `<line class="gv" x1="${x}" y1="0" x2="${x}" y2="${H}" pathLength="1" style="--i:${i}"/>`;
  for (let y = G, j = 0; y < H; y += G, j++) lines += `<line class="gh" x1="0" y1="${y}" x2="${W}" y2="${y}" pathLength="1" style="--i:${j}"/>`;
  const band = `M0 0H${W}V${H}H0Z M${I} ${I}V${H - I}H${W - I}V${I}Z`;
  return `<svg class="cf-grid${faint ? ' is-faint' : ''}${anim ? ' is-anim' : ''}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
<defs><clipPath id="${id}o"><rect width="${W}" height="${H}" rx="${R}"/></clipPath><clipPath id="${id}i"><rect x="${I}" y="${I}" width="${W - 2 * I}" height="${H - 2 * I}"/></clipPath><clipPath id="${id}b"><path d="${band}" clip-rule="evenodd"/></clipPath></defs>
<g clip-path="url(#${id}o)"><path class="band" d="${band}" fill-rule="evenodd"/><g class="gi" clip-path="url(#${id}i)">${lines}</g><g class="gb" clip-path="url(#${id}b)">${lines}</g><rect class="edge" x="${I}" y="${I}" width="${W - 2 * I}" height="${H - 2 * I}"/></g></svg>`;
}

const areaRects = bp => bp.areas.map((a, k) =>
  `<div class="cf-a role-${a.role}${a.off || a.out ? ' is-bad' : ''}" style="${box(a)};border-radius:${a.r}px;--k:${k}" title="${esc(a.name)} · ${a.x}, ${a.y} · ${a.w} × ${a.h}">${a.off || a.out ? `<em>${esc(a.name)}</em>` : ''}</div>`).join('');

function structInner(bp) {
  const o = [];
  bp.fills.forEach(f => o.push(`<div class="cf-s ${f.kind === 'line' ? 'sl' : 'sf'}" style="${box(f)};border-radius:${f.r}px"></div>`));
  bp.media.forEach(m => o.push(`<div class="cf-s sm" style="${box(m)};border-radius:${m.r}px"></div>`));
  bp.graphics.forEach(g => o.push(`<div class="cf-s sg" style="${box(g)};border-radius:${g.round ? '50%' : '8px'}"></div>`));
  bp.controls.forEach(k => o.push(`<div class="cf-s sc" style="${box(k)};border-radius:${k.r}px"></div>`));
  bp.icons.forEach(i => o.push(`<div class="cf-s si" style="${box(i)}"></div>`));
  bp.areas.forEach(a => o.push(`<div class="cf-s so" style="${box(a)};border-radius:${a.r}px"></div>`));
  let k = 0;
  bp.texts.forEach(t => t.lines.forEach(ln => o.push(
    `<div class="cf-wt" style="${box(ln)};font:${t.italic ? 'italic ' : ''}${t.weight} ${t.size}px/${ln.h}px ${famCSS(t.family)};--k:${k++}"><span>${esc(ln.label)}</span><i></i></div>`)));
  return o.join('');
}

function fontsInner(bp) {
  const t = bp.type, L = S.limits;
  const bad = t.sizes.length > L.sizes || t.weights.length > L.weights || t.families.length > L.families;
  return `<div class="cf-ff">
  <div class="cf-ff-head"><span>Schriften</span><span class="${bad ? 'bad' : ''}">${t.sizes.length}/${L.sizes} Größen · ${t.weights.length}/${L.weights} Schnitte</span></div>
  <div class="cf-ff-rows">${t.styles.map(s => `<div class="cf-ff-row${s.bad ? ' bad' : ''}"><span>${esc(s.role)}${s.count > 1 ? ` <em>×${s.count}</em>` : ''}</span><span>${esc(shortFam(s.family))}</span><span>${s.size} · ${s.weight}</span></div>`).join('')}</div>
</div>`;
}

function layerCard(kind, bp) {
  const inner = kind === 'pixels' ? gridSVG(bp)
    : kind === 'areas' ? gridSVG(bp, { faint: true }) + areaRects(bp)
    : kind === 'structure' ? structInner(bp)
    : fontsInner(bp);
  return `<div class="cf-shell cf-layer is-${kind}" style="width:${bp.w}px;height:${bp.h}px">${inner}</div>`;
}

const famLine = bp => bp.type.families.map(f => `${shortFam(f)} für ${(S.families[f] || 'nicht erlaubt').split(':')[0]}`).join('; ') + '.';
const size = bp => `${bp.w} × ${bp.h} px`;
const CAPS = {
  original: bp => ['Original', size(bp), 'Abstand, Schrift und Bild ergeben eine klare Komponente.'],
  pixels: bp => ['Pixel', size(bp), [`Radius ${S.radius} px · Inset ${S.inset} px`, `${Math.round(bp.h / GV())} Zeilen · ${GV()} px`]],
  areas: bp => ['Abstand & Flächen', size(bp), `Farbe klärt Gruppen und Abstände, bevor Details kommen. ${bp.areas.length} Flächen.`],
  structure: bp => ['Struktur', size(bp), 'Schrift und Ausrichtung zeigen die Hierarchie vor dem Feinschliff.'],
  fonts: bp => ['Schriften', `${bp.type.sizes.length} Größen · ${bp.type.weights.length} Schnitte`, famLine(bp)],
};
function caption(kind, bp) {
  const [title, right, sub] = CAPS[kind](bp);
  const second = Array.isArray(sub) ? `<div class="cf-cap-row"><span>${esc(sub[0])}</span><span>${esc(sub[1])}</span></div>` : `<p>${esc(sub)}</p>`;
  return `<figcaption class="cf-cap"><div class="cf-cap-row"><b>${esc(title)}</b><span>${esc(right)}</span></div>${second}</figcaption>`;
}
const LAYERS = ['original', 'pixels', 'areas', 'structure', 'fonts'];

/* ---------- Chrome ---------- */
const main = document.getElementById('cf-main');
const state = {
  view: Q.get('view') || store.get('view', 'canvas'),
  c: Q.get('c'), l: Q.get('l'), solo: Q.has('solo'),
  sel: store.get('sel', {}),
};

function selIndex(c) {
  if (state.l && state.c === c.id) {
    const i = c.layouts.findIndex(l => l.id === state.l);
    if (i >= 0) return i;
  }
  const i = state.sel[c.id] ?? 0;
  return Math.min(i, c.layouts.length - 1);
}
function syncURL() {
  const p = new URLSearchParams();
  p.set('view', state.view);
  if (state.c) p.set('c', state.c);
  if (state.l) p.set('l', state.l);
  if (state.solo) p.set('solo', '');
  if (Q.has('still')) p.set('still', '');
  if (Q.get('system')) p.set('system', Q.get('system'));
  try { history.replaceState(null, '', `${location.pathname}?${p.toString().replace(/=(&|$)/g, '$1')}`); } catch {}
  store.set('view', state.view);
}

function badgeHTML(bps) {
  const list = Array.isArray(bps) ? bps : [bps];
  const n = list.reduce((s, b) => s + b.violations.length, 0);
  const w = list.reduce((s, b) => s + (b.warnings?.length || 0), 0);
  if (!n && w) return `<button class="cf-badge warn" data-act="viol">${w} ${w === 1 ? 'Hinweis' : 'Hinweise'}</button>`;
  return n ? `<button class="cf-badge bad" data-act="viol">${n} ${n === 1 ? 'Verstoß' : 'Verstöße'}</button>`
    : `<span class="cf-badge ok">${icon('check', 14)}Im Raster</span>`;
}
// Befunde mit „Als Ausnahme akzeptieren“ bzw. „zurücknehmen“; withLayout zeigt die Layout-id davor
function findingsItems(bps, withLayout) {
  const li = (b, v, kind) => `<li class="f-${kind}"><code>${esc(withLayout ? b.l : (v.rid || v.rule))}</code><span class="f-msg">${kind === 'warn' ? '<em>Soll · </em>' : kind === 'acc' ? '<em>Ausnahme · </em>' : ''}${esc(v.msg)}${kind === 'acc' && v.reason ? `<i> – ${esc(v.reason)}</i>` : ''}</span>`
    + `<button type="button" class="f-act" data-${kind === 'acc' ? 'unaccept' : 'accept'}="1" data-c="${esc(b.c)}" data-l="${esc(b.l)}" data-rule="${esc(v.rule)}" data-msg="${esc(v.msg)}">${kind === 'acc' ? 'zurücknehmen' : 'Als Ausnahme'}</button></li>`;
  return bps.flatMap(b => [...b.violations.map(v => li(b, v, 'bad')), ...(b.warnings || []).map(v => li(b, v, 'warn')), ...(b.accepted || []).map(v => li(b, v, 'acc'))]).join('');
}
function violHTML(bp) {
  const items = findingsItems([bp]);
  return items ? `<ul class="cf-viol">${items}</ul>` : '';
}
const pillsHTML = (c, li) => `<div class="cf-pills">${c.layouts.map((x, i) => `<button class="${i === li ? 'on' : ''}" data-li="${i}"><span>${pad2(i + 1)}</span>${esc(x.name)}</button>`).join('')}</div>`;

function errorsHTML() {
  if (!F.loadErrors.length) return '';
  return `<div class="cf-errors"><b>Ladefehler</b><ul>${F.loadErrors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
}
function emptyHTML() {
  return `<div class="cf-empty"><h2>Noch keine Komponenten</h2><p>Öffne Claude Code in diesem Ordner und schreib zum Beispiel:</p><pre>Baue eine Komponente „Wetter“ mit drei Layouts.</pre></div>`;
}

function renderSummary() {
  const all = Object.values(F.bps);
  const n = all.reduce((s, b) => s + b.violations.length, 0);
  const w = all.reduce((s, b) => s + (b.warnings?.length || 0), 0);
  const el = document.getElementById('cf-sum');
  if (!el) return;
  el.innerHTML = `<span>${F.components.length} Komponenten · ${all.length} Layouts</span>${n ? `<button class="cf-badge bad" id="cf-sum-bad">${n} ${n === 1 ? 'Verstoß' : 'Verstöße'}</button>` : w ? `<span class="cf-badge warn">${w} ${w === 1 ? 'Hinweis' : 'Hinweise'}</span>` : `<span class="cf-badge ok">${icon('check', 14)}Alle im Raster</span>`}`;
  document.getElementById('cf-sum-bad')?.addEventListener('click', () => {
    const bad = all.find(b => !b.ok);
    state.view = 'layers'; state.c = bad.c; state.solo = false;
    state.sel[bad.c] = F.byId[bad.c].layouts.findIndex(l => l.id === bad.l);
    route();
    document.getElementById(`row-${bad.c}`)?.classList.add('show-viol');
  });
}
function renderMediaBtn() {
  const btn = document.getElementById('cf-media');
  if (!btn) return;
  const n = { folder: window.MEDIA?.length || 0, own: F.media.length };
  const label = { web: 'Web', folder: `Ordner (${n.folder})`, own: `Eigene (${n.own})`, none: 'Platzhalter' }[mediaSource];
  btn.innerHTML = `${icon('image', 16)}<span>Bilder: ${label}</span>`;
}
function cycleMedia() {
  const avail = MEDIA_SOURCES.filter(s => (s === 'web' && webOK) || s === 'none' || (s === 'folder' && window.MEDIA?.length) || (s === 'own' && F.media.length));
  mediaSource = avail[(avail.indexOf(mediaSource) + 1) % avail.length];
  store.set('media', mediaSource);
  renderMediaBtn();
  route(true);
}

/* ---------- Verlauf (Git) ---------- */
const KIND_NAME = { learn: 'Gelernt', claude: 'Claude', tweak: 'Feinschliff', text: 'Text', rules: 'Regeln', undo: 'Rückgängig', restore: 'Zurück', extern: 'Datei', start: 'Start' };
function relTime(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 45) return 'gerade eben';
  if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
  return new Date(iso).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function toast(text, bad) {
  document.querySelector('.cf-toast')?.remove();
  const t = document.createElement('div');
  t.className = `cf-toast${bad ? ' is-bad' : ''}`;
  t.setAttribute('role', 'status');
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}
function keepForReload(text) {
  try { sessionStorage.setItem('cf.toast', text); } catch {}
  const fig = main.querySelector('.cf-lay-item.is-editing');
  if (fig?._ed) setReopen(fig._ed);
}
async function doUndo() {
  try {
    const j = await (await fetch('/api/undo', { method: 'POST' })).json();
    if (!j.ok) return toast(j.error || 'Rückgängig ging nicht.', true);
    keepForReload(`Rückgängig: ${j.subject}`);
    toast(`Rückgängig: ${j.subject}`);
    if (!document.getElementById('cf-hist-pop')?.hidden) renderHistory();
  } catch { toast('Der Server antwortet nicht.', true); }
}
async function renderHistory() {
  const pop = document.getElementById('cf-hist-pop');
  let items = [];
  try { items = (await (await fetch('/api/history', { cache: 'no-store' })).json()).items || []; } catch {}
  const canUndo = items.some(i => !i.undone && i.kind !== 'undo' && i.kind !== 'start');
  pop.innerHTML = `<div class="hi-head"><b>Verlauf</b><button type="button" class="cf-btn is-primary" data-a="undo"${canUndo ? '' : ' disabled'}>↶ Rückgängig</button></div>
    <p class="hi-note">Jede Änderung ist gespeichert, von dir, vom Feinschliff und von Claude. ⌘Z nimmt die letzte zurück, „Hierhin zurück“ stellt einen ganzen Stand wieder her.</p>
    <ol class="hi-list">${items.map((i, n) => `<li class="${i.undone ? 'is-undone' : ''}">
      <span class="hi-kind k-${i.kind}">${KIND_NAME[i.kind] || i.kind}</span>
      <div class="hi-body"><p class="hi-sub">${esc(i.subject.replace(/^(Claude|Feinschliff|Text|Regeln|Rückgängig|Wiederhergestellt): /, ''))}</p>
        <p class="hi-meta">${relTime(i.when)} · ${esc(i.files.slice(0, 2).map(f => f.split('/').pop()).join(', '))}${i.files.length > 2 ? ` +${i.files.length - 2}` : ''}${i.undone ? ' · zurückgenommen' : ''}</p></div>
      <div class="hi-act">${i.parent && compareTargets(i).length ? `<button type="button" class="ed-mini" data-compare="${n}" title="Vorher und nachher nebeneinander">Vergleichen</button>` : ''}${n ? `<button type="button" class="ed-mini" data-restore="${i.sha}" title="Stand nach dieser Änderung wiederherstellen">Hierhin zurück</button>` : '<span class="hi-now">aktuell</span>'}</div>
    </li>`).join('')}</ol>`;
  pop.querySelector('[data-a="undo"]').addEventListener('click', doUndo);
  pop.querySelectorAll('[data-compare]').forEach(b => b.addEventListener('click', () => { pop.hidden = true; openCompare(items[+b.dataset.compare]); }));
  pop.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      const j = await (await fetch('/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sha: b.dataset.restore }) })).json();
      if (!j.ok) { b.disabled = false; return toast(j.error || 'Wiederherstellen ging nicht.', true); }
      keepForReload(j.subject);
      toast(j.subject);
      renderHistory();
    } catch { toast('Der Server antwortet nicht.', true); }
  }));
}
/* ---------- Vorher / Nachher ---------- */
function compareTargets(item) {
  const ids = [...new Set(item.files.map(f => f.match(/^components\/([a-z0-9-]+?)(?:\.tweaks)?\.js$/)?.[1]).filter(id => id && id !== '_index'))];
  const t = ids.map(id => ({ kind: 'c', id, label: F.byId[id]?.name || id }));
  if (item.files.some(f => f === 'factory/system.js' || /^systems\/[a-z0-9-]+\/system\.(js|css)$/.test(f))) t.push({ kind: 'rules', label: 'Regeln' });
  return t;
}
const atURL = (sha, t) => `/@${sha}/index.html?${t.kind === 'rules' ? 'view=rules' : `view=layouts&c=${encodeURIComponent(t.id)}&solo`}&still&media=none&system=${SYS_ID}`;
async function openCompare(item, idx = 0) {
  document.getElementById('cf-cmp')?.remove();
  const targets = compareTargets(item);
  if (!targets.length) return;
  const t = targets[idx];
  const m = document.createElement('div');
  m.id = 'cf-cmp';
  m.className = 'cmp';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-label', 'Vorher und nachher');
  m.innerHTML = `<header class="cmp-head">
      <div class="cmp-title"><b>Vorher / Nachher</b><span>${esc(item.subject)} · ${relTime(item.when)}</span></div>
      ${targets.length > 1 ? `<div class="ed-seg">${targets.map((x, i) => `<button type="button" data-t="${i}"${i === idx ? ' class="on"' : ''}>${esc(x.label)}</button>`).join('')}</div>` : `<span class="cmp-one">${esc(t.label)}</span>`}
      <label class="cmp-sync"><input type="checkbox" id="cmp-sync" checked> Gemeinsam scrollen</label>
      <button type="button" class="cf-btn" data-a="close">${icon('close', 14)}Schließen</button>
    </header>
    <div class="cmp-body">
      <section><p class="cmp-lab">Vorher</p><div class="cmp-frame" data-side="0"></div></section>
      <section><p class="cmp-lab is-after">Nachher</p><div class="cmp-frame" data-side="1"></div></section>
    </div>`;
  document.body.appendChild(m);
  document.documentElement.classList.add('has-modal');
  const close = () => { m.remove(); document.documentElement.classList.remove('has-modal'); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  m.querySelector('[data-a="close"]').addEventListener('click', close);
  m.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { close(); openCompare(item, +b.dataset.t); }));
  const frames = [];
  const sides = [[item.parent, 0], [item.sha, 1]];
  for (const [sha, side] of sides) {
    const box = m.querySelector(`.cmp-frame[data-side="${side}"]`);
    if (t.kind === 'c') {
      const exists = await fetch(`/@${sha}/components/${t.id}.js`, { method: 'HEAD' }).then(r => r.ok).catch(() => false);
      if (!exists) { box.innerHTML = `<p class="cmp-empty">${side ? 'Diese Komponente gibt es in diesem Stand nicht mehr.' : 'Diese Komponente gab es vorher noch nicht.'}</p>`; continue; }
    }
    const f = document.createElement('iframe');
    f.title = side ? 'Nachher' : 'Vorher';
    f.src = atURL(sha, t);
    box.appendChild(f);
    frames.push(f);
    // Sobald das Dokument im Rahmen steht (nicht erst beim load-Ereignis): Kopfzeile ausblenden, Scrollen koppeln
    const t0 = Date.now();
    const prep = () => {
      const d = f.contentDocument;
      if (!d || !d.head || f.contentWindow.location.href === 'about:blank') { if (Date.now() - t0 < 15000 && f.isConnected) setTimeout(prep, 40); return; }
      const st = d.createElement('style');
      st.textContent = '.cf-top,.rs-draft,.cf-edit{display:none!important}.v-layouts,.v-rules{padding-top:24px!important}';
      d.head.appendChild(st);
      f.contentWindow.addEventListener('scroll', () => {
        if (!m.querySelector('#cmp-sync')?.checked || f._sync) { f._sync = false; return; }
        frames.filter(o => o !== f).forEach(o => { o._sync = true; o.contentWindow.scrollTo(0, f.contentWindow.scrollY); });
      });
    };
    prep();
  }
  if (t.kind === 'c') markChanges(m, frames, t.id);
}

// Beide Stände vermessen vergleichen: geänderte Layouts markieren, hinscrollen, im Kopf nennen
function markChanges(m, frames, id) {
  const sig = b => JSON.stringify({ w: b.w, h: b.h, a: b.areas.map(a => [a.name, a.x, a.y, a.w, a.h]), t: b.texts.map(x => [x.text, x.size, x.weight, x.family]), v: b.violations.length });
  const t0 = Date.now();
  const tick = () => {
    if (!m.isConnected) return;
    const ready = frames.filter(f => f.contentDocument?.documentElement?.dataset.ready === '1' && f.contentWindow.Factory?.bps);
    if (ready.length < frames.length) { if (Date.now() - t0 < 20000) setTimeout(tick, 150); return; }
    const maps = frames.map(f => f.contentWindow.Factory.bps);
    const keys = [...new Set(maps.flatMap(b => Object.keys(b)).filter(k => k.startsWith(`${id}/`)))];
    const changed = keys.filter(k => maps.length < 2 || !maps[0][k] || !maps[1][k] || sig(maps[0][k]) !== sig(maps[1][k]));
    const names = changed.map(k => maps[maps.length - 1][k]?.lname || maps[0][k]?.lname || k.split('/')[1]);
    const title = m.querySelector('.cmp-title');
    title.insertAdjacentHTML('beforeend', `<em class="cmp-sum">${changed.length ? `${changed.length} von ${keys.length} Layouts geändert: ${esc(names.join(', '))}` : 'Keine sichtbare Änderung an den Layouts'}</em>`);
    frames.forEach(f => {
      const d = f.contentDocument;
      const st = d.createElement('style');
      st.textContent = '.cmp-changed{outline:3px solid #2f6fea;outline-offset:6px}.cmp-changed-lab{display:inline-block;margin-left:8px;padding:0 8px;border-radius:999px;background:#e8effd;color:#2556b8;font:500 11px/20px Inter,sans-serif}';
      d.head.appendChild(st);
      let first = null;
      changed.forEach(k => {
        const [, lid] = k.split('/');
        const card = d.querySelector(`.cf-card[data-c="${CSS.escape(id)}"][data-l="${CSS.escape(lid)}"]`);
        if (!card) return;
        card.classList.add('cmp-changed');
        card.closest('figure')?.querySelector('figcaption')?.insertAdjacentHTML('beforeend', '<span class="cmp-changed-lab">geändert</span>');
        first ||= card;
      });
      if (first) { f._sync = true; first.scrollIntoView({ block: 'center' }); }
    });
  };
  tick();
}
async function compareLatest() {
  try {
    const items = (await (await fetch('/api/history', { cache: 'no-store' })).json()).items || [];
    const it = items.find(i => i.parent && compareTargets(i).length);
    if (it) openCompare(it);
  } catch {}
}

function initHistory() {
  const btn = document.getElementById('cf-hist');
  if (!btn || !F.live?.history) return;
  btn.hidden = false;
  btn.innerHTML = `${icon('clock', 16)}<span>Verlauf</span>`;
  const pop = document.createElement('div');
  pop.id = 'cf-hist-pop';
  pop.className = 'cf-pop';
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Verlauf');
  document.body.appendChild(pop);
  const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (!pop.hidden) return close();
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    pop.innerHTML = '<p class="hi-note">Lädt …</p>';
    renderHistory();
  });
  document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !pop.hidden) return close();
    const t = e.target;
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !t.isContentEditable && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) { e.preventDefault(); doUndo(); }
  });
  try { const t = sessionStorage.getItem('cf.toast'); if (t) { sessionStorage.removeItem('cf.toast'); toast(t); } } catch {}
}

/* ---------- Regelwerk umschalten ---------- */
function renderSystemSwitch() {
  const box = document.getElementById('cf-sys');
  const list = window.CF_SYSTEMS || [];
  if (!box || list.length < 2) return;
  box.innerHTML = list.map(x => `<button type="button" data-sys="${esc(x.id)}" title="${esc(x.note || '')}"${x.id === SYS_ID ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"'}>${esc(x.name)}</button>`).join('');
  box.querySelectorAll('[data-sys]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.sys === SYS_ID) return;
    try { localStorage.setItem('cf.system', b.dataset.sys); } catch {}
    const p = new URLSearchParams(location.search);
    p.delete('system');
    location.search = p.toString().replace(/=(&|$)/g, '$1');
  }));
}

// Dieselben Komponenten in zwei Regelwerken nebeneinander (nur über tools/serve.mjs)
function openSystemsCompare(otherId) {
  document.getElementById('cf-cmp')?.remove();
  const sys = window.CF_SYSTEMS || [];
  const sides = [SYS_ID, otherId].map(id => sys.find(x => x.id === id) || { id, name: id });
  const m = document.createElement('div');
  m.id = 'cf-cmp';
  m.className = 'cmp';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-label', 'Regelwerke vergleichen');
  m.innerHTML = `<header class="cmp-head">
      <div class="cmp-title"><b>${esc(sides[0].name)} / ${esc(sides[1].name)}</b><span>Dieselben Komponenten in beiden Regelwerken, jeweils nach dessen Regeln gemessen</span></div>
      <label class="cmp-sync"><input type="checkbox" id="cmp-sync" checked> Gemeinsam scrollen</label>
      <button type="button" class="cf-btn" data-a="close">${icon('close', 14)}Schließen</button>
    </header>
    <div class="cmp-body">${sides.map((x, i) => `<section><p class="cmp-lab${i ? ' is-after' : ''}">${esc(x.name)} <span class="cmp-count" data-count="${i}"></span></p><div class="cmp-frame"><iframe title="${esc(x.name)}" src="/index.html?view=layouts&system=${encodeURIComponent(x.id)}&still&media=none"></iframe></div></section>`).join('')}</div>`;
  document.body.appendChild(m);
  document.documentElement.classList.add('has-modal');
  const close = () => { m.remove(); document.documentElement.classList.remove('has-modal'); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  m.querySelector('[data-a="close"]').addEventListener('click', close);
  const frames = [...m.querySelectorAll('iframe')];
  const t0 = Date.now();
  const tick = () => {
    if (!m.isConnected) return;
    const ready = frames.filter(f => f.contentDocument?.documentElement?.dataset.ready === '1' && f.contentWindow.Factory?.bps);
    if (ready.length < 2) { if (Date.now() - t0 < 30000) setTimeout(tick, 200); return; }
    frames.forEach((f, i) => {
      const d = f.contentDocument, bps = Object.values(f.contentWindow.Factory.bps), ok = bps.filter(b => b.ok).length;
      m.querySelector(`[data-count="${i}"]`).textContent = `· ${ok} von ${bps.length} Layouts im Raster`;
      const st = d.createElement('style');
      st.textContent = '.cf-top,.rs-draft,.cf-edit,.cf-stress-btn{display:none!important}.v-layouts{padding-top:24px!important}.cmp-bad{outline:3px solid #c9423a;outline-offset:6px}';
      d.head.appendChild(st);
      bps.filter(b => !b.ok).forEach(b => d.querySelector(`.cf-card[data-c="${CSS.escape(b.c)}"][data-l="${CSS.escape(b.l)}"]`)?.classList.add('cmp-bad'));
      f.contentWindow.addEventListener('scroll', () => {
        if (!m.querySelector('#cmp-sync')?.checked || f._sync) { f._sync = false; return; }
        frames.filter(o => o !== f).forEach(o => { o._sync = true; o.contentWindow.scrollTo(0, f.contentWindow.scrollY); });
      });
    });
  };
  tick();
}

function initChrome() {
  document.querySelectorAll('.cf-tabs button').forEach(b => b.addEventListener('click', () => {
    state.view = b.dataset.view; state.solo = false; route();
  }));
  document.getElementById('cf-media').addEventListener('click', cycleMedia);
  document.getElementById('cf-job')?.addEventListener('click', () => { state.view = 'build'; state.solo = false; route(); });
  if (!Q.get('media')) {
    if (!MEDIA_SOURCES.includes(mediaSource) || mediaSource === 'own' || (mediaSource === 'folder' && !window.MEDIA?.length)) mediaSource = 'web';
    if (window.MEDIA?.length && store.get('media', null) == null) mediaSource = 'folder';
  }
  renderMediaBtn();
  renderSummary();
  renderSystemSwitch();
  initHistory();
  if (mediaSource === 'web') probeWeb();

  const drop = document.getElementById('cf-drop');
  let depth = 0;
  window.addEventListener('dragenter', e => { if (e.dataTransfer?.types?.includes('Files')) { depth++; drop.classList.add('on'); } });
  window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) drop.classList.remove('on'); });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault(); depth = 0; drop.classList.remove('on');
    const files = [...(e.dataTransfer?.files || [])].filter(f => /^(image|video)\//.test(f.type));
    if (!files.length) return;
    F.media.forEach(m => URL.revokeObjectURL(m.src));
    F.media = files.map(f => ({ src: URL.createObjectURL(f), type: f.type.startsWith('video') ? 'video' : 'image' }));
    mediaSource = 'own';
    renderMediaBtn();
    route(true);
  });
}

const VIEWS = { build: viewBuild, layers: viewLayers, layouts: viewLayouts, canvas: viewCanvas, rules: viewRules };
function route(keep) {
  stopCanvas();
  if (!keep) buildRun++;
  if (!VIEWS[state.view]) state.view = 'build';
  document.body.dataset.view = state.view;
  document.querySelectorAll('.cf-tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === state.view));
  VIEWS[state.view](keep);
  syncURL();
  paintJob();
}

/* ---------- Ausnahmen ---------- */
function saveException(cid, lid, rule, msg, reason, remove) {
  const t = (F.tw[cid] ||= {});
  const L = (t[lid] ||= {});
  L.exceptions = (L.exceptions || []).filter(e => !(e.rule === rule && e.msg === msg && (!e.system || e.system === SYS_ID)));
  if (!remove) L.exceptions.push({ system: SYS_ID, rule, msg, reason, when: new Date().toISOString().slice(0, 10) });
  saveTweaks(cid, remove ? `Ausnahme zurückgenommen: ${cid}/${lid}` : `Ausnahme: ${cid}/${lid} – ${reason}`);
  const c = F.byId[cid], l = c?.layouts.find(x => x.id === lid);
  if (c && l) F.bps[`${cid}/${lid}`] = measureTemp(c, l);
  consistencyPass();
  renderSummary();
  const y = scrollY;
  const fig = main.querySelector('.cf-lay-item.is-editing');
  if (fig?._ed) { remeasure(fig._ed); renderPanel(fig._ed); return; }
  route(true);
  scrollTo(0, y);
  document.getElementById(`row-${cid}`)?.classList.add('show-viol');
  document.getElementById(`lay-${cid}`)?.classList.add('show-viol');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-accept], [data-unaccept]');
  if (!b) return;
  e.preventDefault();
  const { c, l, rule, msg } = b.dataset;
  if (b.dataset.unaccept) return saveException(c, l, rule, msg, null, true);
  const li = b.closest('li');
  if (li.querySelector('.f-form')) return;
  li.insertAdjacentHTML('beforeend', `<form class="f-form"><input id="f-why-${Date.now()}" placeholder="Warum ist das hier in Ordnung?" aria-label="Begründung der Ausnahme" required><button type="submit" class="cf-btn is-primary">Akzeptieren</button><button type="button" class="cf-btn" data-a="f-cancel">Abbrechen</button></form>`);
  const form = li.querySelector('.f-form');
  form.querySelector('input').focus();
  form.querySelector('[data-a="f-cancel"]').addEventListener('click', () => form.remove());
  form.addEventListener('submit', ev => { ev.preventDefault(); const why = form.querySelector('input').value.trim(); if (why) saveException(c, l, rule, msg, why); });
});

/* ---------- Ansicht: Schichten ---------- */
function rowHTML(c) {
  const li = selIndex(c), l = c.layouts[li], bp = bpOf(c, l);
  return `<section class="cf-row" id="row-${esc(c.id)}" data-c="${esc(c.id)}">
  <header class="cf-row-head"><h2>${esc(c.name)}</h2>${pillsHTML(c, li)}${badgeHTML(bp)}${l.idea ? `<p class="cf-idea">${esc(l.idea)}</p>` : ''}</header>
  ${violHTML(bp)}
  <div class="cf-track">${LAYERS.map(k => `<figure class="cf-slot">${k === 'original' ? cardHTML(c, l) : layerCard(k, bp)}${caption(k, bp)}</figure>`).join('')}</div>
</section>`;
}
function bindRow(row) {
  const c = F.byId[row.dataset.c];
  row.querySelectorAll('.cf-pills button').forEach(b => b.addEventListener('click', () => {
    state.sel[c.id] = +b.dataset.li; store.set('sel', state.sel);
    state.c = c.id; state.l = null;
    const open = row.classList.contains('show-viol');
    const scroll = row.querySelector('.cf-track').scrollLeft;
    row.outerHTML = rowHTML(c);
    const next = document.getElementById(`row-${c.id}`);
    next.classList.toggle('show-viol', open);
    next.querySelector('.cf-track').scrollLeft = scroll;
    bindRow(next);
    syncURL();
  }));
  row.querySelector('[data-act="viol"]')?.addEventListener('click', () => row.classList.toggle('show-viol'));
}
function viewLayers() {
  const list = state.solo && state.c ? F.components.filter(c => c.id === state.c) : F.components;
  main.innerHTML = `<div class="v-layers">${errorsHTML()}${list.length ? list.map(rowHTML).join('') : emptyHTML()}</div>`;
  main.querySelectorAll('.cf-row').forEach(bindRow);
  if (state.solo) main.querySelectorAll('.cf-row').forEach(r => r.classList.add('show-viol'));
  else if (state.c) requestAnimationFrame(() => document.getElementById(`row-${state.c}`)?.scrollIntoView({ block: 'start' }));
}

/* ---------- Ansicht: Layouts ---------- */
/* ---------- Zustände und Familien ---------- */
const STATES = [
  { id: 'normal', name: 'Normal' },
  { id: 'hover', name: 'Hover' },
  { id: 'loading', name: 'Lädt' },
  { id: 'empty', name: 'Leer' },
  { id: 'error', name: 'Fehler' },
];
const FAMILY_NAME = { karte: 'Karte', listenzeile: 'Listenzeile', teaser: 'Teaser' };
function statesResults(c) {
  return STATES.filter(x => x.id !== 'normal' && (c.states || []).includes(x.id)).map(st => {
    const bps = c.layouts.map(l => withRender({ state: st.id }, () => measureTemp(c, l)));
    return { ...st, bad: bps.filter(b => !b.ok).length, bps };
  });
}
function familyPrompt(c, want) {
  const fam = want.filter(x => FAMILY_NAME[x]), st = want.filter(x => STATES.some(s => s.id === x));
  return `Komponentenfamilie und Zustände für „${c.name}“ (components/${c.id}.js), dieselbe visuelle Logik wie die bestehenden Layouts:
${fam.length ? `- Familie: ergänze Layouts mit ${fam.map(f => `family: "${f}"`).join(' und ')}. ${fam.includes('listenzeile') ? 'Listenzeile = eine Zeile in einer Liste, volle Kartenbreite, flach (etwa 72–96 px hoch), dieselben Inhalte knapp. ' : ''}${fam.includes('teaser') ? 'Teaser = redaktioneller Anreißer: Bild, Überschrift, Unterzeile. ' : ''}Bestehende Layouts bekommen family: "karte".
` : ''}${st.length ? `- Zustände: setze states: [${st.map(x => `"${x}"`).join(', ')}] an der Komponente. render(d, h) fragt h.state ab: ${st.includes('loading') ? '"loading" = Skelett in den echten Flächen, gleiche Maße; ' : ''}${st.includes('empty') ? '"empty" = freundlicher Leerzustand mit einer Handlung; ' : ''}${st.includes('error') ? '"error" = kurze Fehlermeldung mit „Erneut versuchen“; ' : ''}${st.includes('hover') ? '"hover" = Bedienbares hervorheben, Stil über die Klasse .is-hover an der Karte (zusätzlich zu :hover); ' : ''}jeder Zustand passt in dieselbe Höhe und erfüllt die Regeln.
` : ''}Prüfe mit node tools/check.mjs ${c.id} --states --system ${SYS_ID}.`;
}
function bindStates(sec, c) {
  const bar = sec.querySelector('.cf-statebar'), grid = sec.querySelector('.cf-lay-grid');
  sec.querySelector('[data-act="states"]')?.addEventListener('click', e => {
    const btn = e.currentTarget;
    if (!bar.hidden) { bar.hidden = true; btn.classList.remove('on'); grid.innerHTML = layGridHTML(c); bindLayItems(sec); return; }
    bar.hidden = false;
    btn.classList.add('on');
    const res = statesResults(c);
    const has = (c.states || []).length;
    const fams = [...new Set(c.layouts.map(l => l.family).filter(Boolean))];
    bar.innerHTML = `${has ? `<div class="cf-varrow"><span class="ed-lab">Zustand</span><div class="ed-seg">${STATES.filter(x => x.id === 'normal' || c.states.includes(x.id)).map(x => { const r = res.find(y => y.id === x.id); return `<button type="button" data-state="${x.id}"${x.id === 'normal' ? ' class="on"' : ''}>${esc(x.name)}${r ? `<em class="${r.bad ? 'is-bad' : 'is-ok'}">${r.bad || '✓'}</em>` : ''}</button>`; }).join('')}</div></div>` : '<p class="cf-stress-sum">Diese Komponente hat noch keine Zustände (Hover, Lädt, Leer, Fehler).</p>'}
      <div class="cf-varrow"><span class="ed-lab">Familie</span><span class="cf-varhint">${fams.length ? fams.map(f => FAMILY_NAME[f] || f).join(' · ') : 'nur Karten'}</span></div>
      <div class="cf-varrow"><span class="ed-lab">Ergänzen</span><div class="cf-checks">${[['listenzeile', 'Listenzeile'], ['teaser', 'Teaser'], ['hover', 'Hover'], ['loading', 'Lädt'], ['empty', 'Leer'], ['error', 'Fehler']]
        .filter(([k]) => !fams.includes(k) && !(c.states || []).includes(k)).map(([k, n]) => `<label><input type="checkbox" value="${k}" checked> ${n}</label>`).join('') || '<span class="cf-varhint">alles da</span>'}</div>
        <button type="button" class="cf-btn is-primary" data-a="fam-go">${F.live ? 'Von Claude ergänzen lassen' : 'Anweisung für Claude'}</button></div>
      <div class="b-log ed-log cf-famlog"></div>`;
    bar.querySelectorAll('[data-state]').forEach(b => b.addEventListener('click', () => {
      bar.querySelectorAll('[data-state]').forEach(x => x.classList.toggle('on', x === b));
      grid.innerHTML = layGridHTML(c, { state: b.dataset.state });
      bindLayItems(sec);
    }));
    bar.querySelector('[data-a="fam-go"]').addEventListener('click', () => {
      const want = [...bar.querySelectorAll('.cf-checks input:checked')].map(x => x.value);
      if (!want.length) return;
      const prompt = familyPrompt(c, want), log = bar.querySelector('.cf-famlog');
      if (!F.live) return copyHint(log, 'Anweisung für Claude Code', prompt);
      bar.querySelectorAll('button, input').forEach(x => { x.disabled = true; });
      generate(prompt, { log, view: 'layouts' });
    });
  });
}

/* ---------- Breakpoints: dieselben Regeln in mehreren Breiten ---------- */
let layWidth = null;
const widthsOf = () => S.widths || [320, S.width, 432];
function widthResults(w) {
  return F.components.flatMap(c => c.layouts.map(l => ({ c, l, bp: withRender({ width: w }, () => measureTemp(c, l)) })));
}
function widthToolsHTML() {
  return `<div class="cf-laytools"><span class="ed-lab">Breite</span>${seg('lw', layWidth || '', [['', 'wie gebaut'], ...widthsOf().map(w => [w, `${w} px`])])}<span class="cf-wsum" id="cf-wsum"></span><div class="b-log ed-log cf-wlog"></div></div>`;
}
function bindWidthTools() {
  main.querySelectorAll('[data-seg="lw"]').forEach(b => b.addEventListener('click', () => { layWidth = b.dataset.v ? +b.dataset.v : null; const y = scrollY; viewLayouts(); scrollTo(0, y); }));
  const sum = document.getElementById('cf-wsum');
  if (!layWidth || !sum) return;
  const res = widthResults(layWidth), bad = res.filter(x => !x.bp.ok);
  sum.innerHTML = bad.length ? `bei ${layWidth} px brechen <b>${bad.length} von ${res.length}</b> Layouts${F.live ? ` <button type="button" class="cf-btn" data-a="w-fix">Von Claude anpassen lassen</button>` : ''}` : `bei ${layWidth} px halten alle ${res.length} Layouts`;
  sum.querySelector('[data-a="w-fix"]')?.addEventListener('click', e => {
    e.currentTarget.disabled = true;
    const lines = bad.map(x => `- ${x.c.id} / ${x.l.id}: ${x.bp.violations.slice(0, 3).map(v => v.msg).join('; ')}`).join('\n');
    generate(`Breakpoints: Diese Layouts brechen bei ${layWidth} px Kartenbreite (sonst ${S.width} px). Mach sie in allen Breiten ${widthsOf().join(', ')} px regelkonform, ohne sie bei ${S.width} px zu verändern. h.width liefert die aktuelle Breite; height darf eine Funktion der Breite sein (height: w => …). Gleiche Regeln des aktiven Regelwerks.\n${lines}\nPrüfe mit node tools/check.mjs --widths --system ${SYS_ID}.`, { log: main.querySelector('.cf-wlog'), view: 'layouts' });
  });
}

/* ---------- Übergabe: HTML/CSS, Tokens, React, Figma ---------- */
async function runExport(kind, cid) {
  const r = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id: cid, system: SYS_ID }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `Export fehlgeschlagen (${r.status})`);
  return j.files || [];
}
const fileLinks = files => files.map(f => `<a href="/${esc(f)}" target="_blank" rel="noopener"><code>${esc(f)}</code></a>`).join(' ');
function sveltePrompt(c) {
  const Name = c.id.replace(/(^|-)([a-z])/g, (m, a, b) => b.toUpperCase());
  return `Übergabe als Svelte: Komponente „${c.name}“ (components/${c.id}.js), Regelwerk ${S.name} (${SYS_ID}).
Erst node tools/export.mjs tokens --system ${SYS_ID} und node tools/export.mjs html ${c.id} --system ${SYS_ID} (Referenz, exakt so soll es aussehen).
Dann schreib export/${SYS_ID}/${c.id}/svelte/${Name}.svelte und README.md:
- eine Svelte-5-Komponente (Runes: \$props, \$derived) <${Name} layout="${c.layouts[0].id}" …>, layout ∈ ${c.layouts.map(l => `"${l.id}"`).join(', ')}${(c.states || []).length ? `, optional state ∈ ${c.states.map(x => `"${x}"`).join(', ')}` : ''}
- Props für alle Inhalte aus data (sinnvolle Namen, Standardwerte = heutige Beispieldaten), Bilder als src-Props
- Markup, Flächen und Maße 1:1 wie in der Fabrik; Stile im <style> der Komponente (scoped); Tokens nur als CSS-Variablen aus export/${SYS_ID}/tokens.css, keine festen Farbwerte
- Bedienelemente als echte <button> mit aria-label, Callback-Props (onplay, onselect …)
- README: Einbindung (SvelteKit und Vite), Props-Tabelle, Hinweis auf tokens.css und die Schriften
Keine neuen Abhängigkeiten außer svelte. Ändere components/${c.id}.js nicht.`;
}
function figmaPrompt(c) {
  return `Übergabe nach Figma: Komponente „${c.name}“ (components/${c.id}.js), Regelwerk ${S.name} (${SYS_ID}).
1. node tools/export.mjs figma ${c.id} --system ${SYS_ID} schreibt export/${SYS_ID}/${c.id}.figma.json.
2. figma_get_status: welche Datei ist verbunden? Pinne sie mit figma_navigate (lock: true). Nicht in Bibliotheksdateien wie ZDS-Icons oder dem ZDS-Dokument bauen – dann abbrechen und melden.
3. Führe den Inhalt von tools/figma-builder.js per figma_execute aus (legt globalThis.CF an).
4. Dann: await CF.buildFromURL('http://localhost:4173/export/${SYS_ID}/${c.id}.figma.json'). Wenn das Plugin nicht laden darf: JSON-Datei lesen und await CF.build(<Inhalt>) aufrufen.
5. Berichte Seite, Section, Set-ID und die Hinweise aus dem Ergebnis (notes).`;
}
function bindHandoff(sec, c) {
  const bar = sec.querySelector('.cf-handbar');
  sec.querySelector('[data-act="handoff"]')?.addEventListener('click', e => {
    const btn = e.currentTarget;
    if (!bar.hidden) { bar.hidden = true; btn.classList.remove('on'); return; }
    bar.hidden = false;
    btn.classList.add('on');
    bar.innerHTML = `<p class="cf-stress-sum"><b>Übergabe</b> im Regelwerk ${esc(S.name)} – Regeln und Tokens bleiben erhalten. Dateien landen in <code>export/${SYS_ID}/</code>.</p>
      <div class="cf-hand">
        <div><b>HTML + CSS</b><span>Eigenständige Seite mit allen Layouts, Tokens und Typo-Klassen.</span><button type="button" class="cf-btn" data-ex="html"${F.live ? '' : ' disabled'}>Exportieren</button></div>
        <div><b>Tokens</b><span>W3C-Design-Tokens (JSON) und CSS-Variablen des Regelwerks.</span><button type="button" class="cf-btn" data-ex="tokens"${F.live ? '' : ' disabled'}>Exportieren</button></div>
        <div><b>Web Component</b><span>&lt;cf-${esc(c.id)}&gt; mit Shadow DOM – derselbe Code wie hier, samt Feinschliff und Zuständen; Inhalte über el.data.</span><button type="button" class="cf-btn" data-ex="wc"${F.live ? '' : ' disabled'}>Exportieren</button></div>
        <div><b>Svelte</b><span>Svelte-5-Komponente mit Props für Inhalte, Layout und Zustand, README.</span><button type="button" class="cf-btn is-primary" data-ex="svelte">${F.live ? 'Von Claude bauen lassen' : 'Anweisung für Claude'}</button></div>
        <div><b>Figma</b><span>Component Set mit den Layouts als Varianten, Auto-Layout, Farben als Variablen.</span><button type="button" class="cf-btn" data-ex="figma-data"${F.live ? '' : ' disabled'}>Figma-Daten</button><button type="button" class="cf-btn is-primary" data-ex="figma">${F.live ? 'Nach Figma (Claude)' : 'Anweisung für Claude'}</button></div>
      </div>
      <p class="cf-handout"></p>
      <div class="b-log ed-log cf-handlog"></div>`;
    const out = bar.querySelector('.cf-handout'), log = bar.querySelector('.cf-handlog');
    bar.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.ex;
      if (k === 'svelte' || k === 'figma') {
        const prompt = k === 'svelte' ? sveltePrompt(c) : figmaPrompt(c);
        if (!F.live) return copyHint(log, 'Anweisung für Claude Code', prompt);
        bar.querySelectorAll('button').forEach(x => { x.disabled = true; });
        return generate(prompt, { log, view: 'layouts', figma: k === 'figma' });
      }
      b.disabled = true;
      out.textContent = 'Exportiert …';
      try { out.innerHTML = `Geschrieben: ${fileLinks(await runExport(k === 'figma-data' ? 'figma' : k, k === 'tokens' ? null : c.id))}`; }
      catch (err) { out.textContent = err.message; }
      b.disabled = false;
    }));
  });
}

/* ---------- Varianten gezielt erzeugen ---------- */
const DIRECTIONS = [
  { id: 'kompakter', name: 'Kompakter', desc: 'weniger Höhe, dichtere Abstände, nur das Nötigste bleibt sichtbar' },
  { id: 'editorialer', name: 'Editorialer', desc: 'mehr Ruhe und Lesefluss, die Überschrift in der Überschriften- oder Akzentschrift, Bild und Text wie ein Teaser' },
  { id: 'hierarchischer', name: 'Stärker hierarchisiert', desc: 'eine klare Hauptinformation, deutliche Größenunterschiede, Nebensachen zurückgenommen' },
  { id: 'mobil', name: 'Mobil · 320 px', desc: 'für schmale Bildschirme: width 320, einspaltig, große Trefferflächen' },
  { id: 'ruhiger', name: 'Ruhiger', desc: 'weniger Elemente, weniger Farbe, mehr Weißraum' },
  { id: 'bildstaerker', name: 'Bildstärker', desc: 'das Bild führt: größer oder randabfallend, Text knapp darunter oder darauf' },
];
const dirName = id => DIRECTIONS.find(d => d.id === id)?.name || id || 'Variante';
const feedbackFor = (cid, lid) => (window.CF_FEEDBACK || []).filter(f => f.c === cid && f.l === lid);
function variantDecisionHTML(c, l) {
  const f = feedbackFor(c.id, l.id).pop();
  if (f) return `<p class="cf-vardone">${f.decision === 'behalten' ? 'Behalten' : 'Verworfen'}${f.comment ? ` – ${esc(f.comment)}` : ''}</p>`;
  return `<div class="cf-vardec"><button type="button" class="cf-btn" data-vardec="behalten" data-c="${esc(c.id)}" data-l="${esc(l.id)}">${icon('check', 14)}Behalten</button><button type="button" class="cf-btn" data-vardec="verworfen" data-c="${esc(c.id)}" data-l="${esc(l.id)}">${icon('close', 14)}Verwerfen</button></div>`;
}
function variantPrompt(c, l, dir, note) {
  const d = DIRECTIONS.find(x => x.id === dir);
  const nid = `${l.id}-${dir}`;
  return `Variante erzeugen: Komponente „${c.name}“ (components/${c.id}.js), ausgehend vom Layout „${l.name}“ (id ${l.id}). Richtung: ${d.name.toLowerCase()} – ${d.desc}.${note ? `\nWorauf achten: ${note}` : ''}
Füge ein NEUES Layout hinzu, das Ausgangslayout bleibt unverändert: id „${nid}“ (falls vergeben, eine freie id), name „${l.name} · ${d.name}“, variantOf: „${l.id}“, direction: „${dir}“. Gleiche Daten, gleiche Regeln des aktiven Regelwerks.
Schreib in idea zwei kurze Sätze: was die Variante anders macht als „${l.name}“ und warum das der Richtung dient – konkret, z. B. „Nutzt die Breite besser und hält die Textkante konsistent.“
Berücksichtige feedback/praeferenzen.js (was das Team bisher behalten oder verworfen hat) und feedback/leitsaetze.js (bestätigte Leitsätze gelten wie Soll-Regeln, auch gegen die Beschreibung der Richtung). Die Variante muss die Prüfung bestehen.`;
}
function bindVariant(sec, c) {
  const bar = sec.querySelector('.cf-varbar');
  sec.querySelector('[data-act="variant"]')?.addEventListener('click', e => {
    const btn = e.currentTarget;
    if (!bar.hidden) { bar.hidden = true; btn.classList.remove('on'); return; }
    bar.hidden = false;
    btn.classList.add('on');
    const base = c.layouts.filter(l => !l.variantOf);
    bar.innerHTML = `<div class="cf-varrow"><span class="ed-lab">Ausgehend von</span>${seg('vbase', base[0]?.id, base.map((l, i) => [l.id, `${pad2(i + 1)} ${esc(l.name)}`]))}</div>
      <div class="cf-varrow"><span class="ed-lab">Richtung</span>${seg('vdir', 'kompakter', DIRECTIONS.map(d => [d.id, esc(d.name), d.desc]))}</div>
      <div class="cf-varrow"><span class="ed-lab">Worauf achten</span><input id="cf-varnote-${esc(c.id)}" placeholder="optional, z. B. „Uhrzeit bleibt groß“" aria-label="Worauf achten"></div>
      <div class="cf-varrow"><span class="ed-lab"></span><button type="button" class="cf-btn is-primary" data-a="var-go">${F.live ? 'Variante von Claude bauen lassen' : 'Anweisung für Claude'}</button><span class="cf-varhint">Gleiche Daten, gleiche Regeln – die Variante erscheint als neues Layout daneben.</span></div>
      <div class="b-log ed-log cf-varlog"></div>`;
    bar.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => bar.querySelectorAll(`[data-seg="${b.dataset.seg}"]`).forEach(x => x.classList.toggle('on', x === b))));
    bar.querySelector('[data-a="var-go"]').addEventListener('click', () => {
      const pick = k => bar.querySelector(`[data-seg="${k}"].on`)?.dataset.v;
      const l = c.layouts.find(x => x.id === pick('vbase')) || base[0];
      const prompt = variantPrompt(c, l, pick('vdir') || 'kompakter', bar.querySelector('input').value.trim());
      const log = bar.querySelector('.cf-varlog');
      if (!F.live) return copyHint(log, 'Anweisung für Claude Code', prompt);
      bar.querySelectorAll('button, input').forEach(x => { x.disabled = true; });
      generate(prompt, { log, view: 'layouts' });
    });
  });
}
// Behalten / Verwerfen: als Präferenz festhalten (feedback/praeferenzen.js), Verwerfen entfernt das Layout über Claude
document.addEventListener('click', e => {
  const b = e.target.closest('[data-vardec]');
  if (!b) return;
  const box = b.closest('.cf-vardec');
  if (box.querySelector('.f-form')) return;
  const { vardec, c, l } = b.dataset;
  box.insertAdjacentHTML('beforeend', `<form class="f-form"><input id="cf-vcom-${Date.now()}" placeholder="${vardec === 'behalten' ? 'Was ist daran gut?' : 'Was passt nicht?'} (optional)" aria-label="Kommentar"><button type="submit" class="cf-btn is-primary">${vardec === 'behalten' ? 'Behalten' : 'Verwerfen'}</button></form>`);
  const form = box.querySelector('.f-form');
  form.querySelector('input').focus();
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const comp = F.byId[c], lay = comp.layouts.find(x => x.id === l);
    const entry = { system: SYS_ID, c, l, name: lay.name, idea: lay.idea || '', direction: lay.direction || null, variantOf: lay.variantOf || null, decision: vardec, comment: form.querySelector('input').value.trim() };
    window.CF_FEEDBACK = [...(window.CF_FEEDBACK || []), { ...entry, when: new Date().toISOString().slice(0, 10) }];
    if (F.live) { try { await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }); } catch {} }
    if (vardec === 'verworfen' && F.live) {
      const log = document.createElement('div');
      log.className = 'b-log ed-log';
      box.replaceWith(log);
      generate(`Die Variante „${lay.name}“ (id ${l}) in components/${c}.js wurde verworfen${entry.comment ? ` („${entry.comment}“)` : ''}. Entferne genau dieses Layout, sonst nichts ändern. Prüfe mit node tools/check.mjs ${c}.`, { log, view: 'layouts' });
      return;
    }
    box.outerHTML = variantDecisionHTML(comp, lay);
  });
});

// opts: { scen: Stresstest-Fall, state: Zustand, width: Breite } – alles gleichzeitig möglich
function layGridHTML(c, opts = {}) {
  const scen = opts.scen && opts.scen.id !== 'normal' ? opts.scen : null;
  const cond = { state: opts.state && opts.state !== 'normal' ? opts.state : null, width: opts.width || layWidth || null };
  const special = scen || cond.state || cond.width;
  const run = (l, fn) => withRender(cond, () => (scen ? withData(c, stressData(c.data, scen.id), fn) : fn()));
  return c.layouts.map((l, i) => {
    const sb = special ? run(l, () => measureTemp(c, l)) : null;
    const card = special ? run(l, () => cardHTML(c, l)) : cardHTML(c, l);
    return `<figure class="cf-lay-item" data-c="${esc(c.id)}" data-li="${i}">
    <figcaption><span>${pad2(i + 1)}</span>${esc(l.name)}${l.variantOf ? `<em class="cf-varchip" title="Variante von ${esc(l.variantOf)}">${esc(dirName(l.direction))}</em>` : ''}${l.family && l.family !== 'karte' ? `<em class="cf-famchip">${esc(FAMILY_NAME[l.family] || l.family)}</em>` : ''}${state.solo || sb ? '' : `<button class="cf-edit" type="button">${icon('edit', 14)}Bearbeiten</button>`}${sb ? badgeHTML(sb) : ''}</figcaption>
    ${l.variantOf && !sb && !state.solo ? variantDecisionHTML(c, l) : ''}
    <div class="cf-lay-card">${card}</div>
    ${sb && sb.violations.length ? `<ul class="cf-sviol">${sb.violations.map(v => `<li><code>${esc(v.rule)}</code>${esc(v.msg)}</li>`).join('')}</ul>` : l.idea && !sb ? `<p>${esc(l.idea)}</p>` : ''}
  </figure>`;
  }).join('');
}

/* ---------- Stresstest: dieselben Layouts mit anderen Inhalten ---------- */
const STRESS = [
  { id: 'normal', name: 'Normal' },
  { id: 'lang', name: 'Lange Wörter' },
  { id: 'leer', name: 'Leer' },
  { id: 'eins', name: 'Ein Eintrag' },
  { id: 'viele', name: 'Zwölf Einträge' },
];
const LONG_WORDS = ['Bundesausbildungsförderungsgesetz', 'Donaudampfschifffahrtsgesellschaft', 'Grundstücksverkehrsgenehmigung', 'Rindfleischetikettierungsgesetz'];
const TECH_KEY = /^(tz|id|icon|type|kind|src|href|url|color|accent|code|unit|lat|lon)$/i;
function stressData(data, kind) {
  let n = 0;
  const walk = (v, key) => {
    if (Array.isArray(v)) {
      const items = v.map(x => walk(x));
      if (kind === 'leer') return [];
      if (kind === 'eins') return items.slice(0, 1);
      if (kind === 'viele' && items.length) return Array.from({ length: Math.max(12, items.length) }, (_, i) => JSON.parse(JSON.stringify(items[i % items.length])));
      return items;
    }
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    if (kind === 'lang' && typeof v === 'string' && !TECH_KEY.test(key || '') && /[a-zäöüß]{3,}/i.test(v)) return `${v} ${LONG_WORDS[n++ % LONG_WORDS.length]}`;
    return v;
  };
  return walk(JSON.parse(JSON.stringify(data)));
}
function withData(c, data, fn) {
  const keep = c.data;
  c.data = data;
  try { return fn(); } finally { c.data = keep; }
}
function measureTemp(c, l) {
  const host = document.createElement('div');
  host.id = 'cf-measure';
  document.body.appendChild(host);
  try { return measure(c, l, host); } finally { host.remove(); }
}
function stressResults(c) {
  return STRESS.filter(x => x.id !== 'normal').map(sc => {
    const data = stressData(c.data, sc.id);
    const bps = c.layouts.map(l => withData(c, data, () => measureTemp(c, l)));
    return { ...sc, bad: bps.filter(b => !b.ok).length, bps };
  });
}
function bindStress(sec, c) {
  const bar = sec.querySelector('.cf-stressbar');
  const grid = sec.querySelector('.cf-lay-grid');
  sec.querySelector('[data-act="stress"]')?.addEventListener('click', e => {
    const btn = e.currentTarget;
    if (!bar.hidden) { bar.hidden = true; btn.classList.remove('on'); grid.innerHTML = layGridHTML(c); bindLayItems(sec); return; }
    const res = stressResults(c);
    const total = res.reduce((n, r) => n + r.bad, 0);
    bar.hidden = false;
    btn.classList.add('on');
    bar.innerHTML = `<p class="cf-stress-sum">${total ? `<b>${total} von ${res.length * c.layouts.length}</b> Fällen brechen` : '<b>Alle Fälle</b> halten'} – dieselben Layouts mit anderen Inhalten, gemessen nach denselben Regeln.</p>
      <div class="ed-seg">${STRESS.map(sc => { const r = res.find(x => x.id === sc.id); return `<button type="button" data-scen="${sc.id}"${sc.id === 'normal' ? ' class="on"' : ''}>${esc(sc.name)}${r ? `<em class="${r.bad ? 'is-bad' : 'is-ok'}">${r.bad ? r.bad : '✓'}</em>` : ''}</button>`; }).join('')}</div>`;
    bar.querySelectorAll('[data-scen]').forEach(b => b.addEventListener('click', () => {
      bar.querySelectorAll('[data-scen]').forEach(x => x.classList.toggle('on', x === b));
      grid.innerHTML = layGridHTML(c, { scen: STRESS.find(x => x.id === b.dataset.scen) });
      bindLayItems(sec);
    }));
  });
}
function bindLayItems(scope) {
  scope.querySelectorAll('.cf-lay-item .cf-edit').forEach(b => b.addEventListener('click', () => toggleEdit(b.closest('.cf-lay-item'))));
}

function viewLayouts() {
  const list = state.solo && state.c ? F.components.filter(c => c.id === state.c) : F.components;
  main.innerHTML = `<div class="v-layouts">${errorsHTML()}${state.solo ? '' : widthToolsHTML()}${list.length ? list.map(c => {
    const bps = c.layouts.map(l => bpOf(c, l));
    return `<section class="cf-lay" id="lay-${esc(c.id)}">
  <header class="cf-row-head"><h2>${esc(c.name)}</h2>${badgeHTML(bps)}${state.solo ? '' : `<button type="button" class="cf-edit cf-stress-btn" data-act="stress">${icon('refresh', 14)}Stresstest</button><button type="button" class="cf-edit cf-var-btn" data-act="variant">${icon('plus', 14)}Variante</button><button type="button" class="cf-edit cf-var-btn" data-act="states">${icon('grid', 14)}Familie & Zustände</button><button type="button" class="cf-edit cf-var-btn" data-act="handoff">${icon('arrow-up-right', 14)}Übergabe</button>`}</header>
  <ul class="cf-viol">${findingsItems(bps, true)}</ul>
  <div class="cf-stressbar" hidden></div>
  <div class="cf-varbar" hidden></div>
  <div class="cf-varbar cf-statebar" hidden></div>
  <div class="cf-varbar cf-handbar" hidden></div>
  <div class="cf-lay-grid">${layGridHTML(c)}</div>
</section>`;
  }).join('') : emptyHTML()}</div>`;
  main.querySelectorAll('.cf-lay [data-act="viol"]').forEach(b => b.addEventListener('click', () => b.closest('.cf-lay').classList.toggle('show-viol')));
  bindLayItems(main);
  main.querySelectorAll('.cf-lay').forEach(sec => { const c = F.byId[sec.id.slice(4)]; bindStress(sec, c); bindVariant(sec, c); bindStates(sec, c); bindHandoff(sec, c); });
  bindWidthTools();
  if (state.solo) main.querySelectorAll('.cf-lay').forEach(r => r.classList.add('show-viol'));
  else if (state.c) requestAnimationFrame(() => document.getElementById(`lay-${state.c}`)?.scrollIntoView({ block: 'start' }));
  const ro = takeReopen();
  if (ro) {
    const fig = main.querySelector(`.cf-lay-item[data-c="${CSS.escape(ro.c)}"][data-li="${ro.li}"]`);
    if (fig) { toggleEdit(fig, { sel: ro.sel }); requestAnimationFrame(() => scrollTo(0, ro.y)); }
  }
  const note = takeNote(state.c);
  if (note?.text && state.c) {
    const sec = document.getElementById(`lay-${state.c}`);
    sec?.querySelector('.cf-row-head').insertAdjacentHTML('afterend', `<p class="cf-claude-note">Claude: ${esc(note.text)}${F.live?.history ? ' <button type="button" class="ed-mini" data-a="cmp-latest">Vorher / Nachher</button>' : ''}</p>`);
    sec?.querySelector('[data-a="cmp-latest"]')?.addEventListener('click', compareLatest);
  }
}

/* ---------- Ansicht: Regeln ---------- */
const ROLE_INFO = {
  media: 'Bilder, Videos, Grafiken',
  text: 'Überschriften, Listen, Werte',
  control: 'Buttons, Regler, Eingaben',
  meta: 'Fortschritt, Zeit, Status',
};
const codeText = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>');
const mini = (html, w, h, k) => `<div class="rs-mini" style="width:${Math.round(w * k)}px;height:${Math.round(h * k)}px"><div style="width:${w}px;height:${h}px;transform:scale(${k});transform-origin:0 0">${html}</div></div>`;

function colorTokens() {
  const names = new Set();
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules) if (r.selectorText === ':root') for (const p of r.style) if (p.startsWith('--c-')) names.add(p);
  }
  const cs = getComputedStyle(document.documentElement);
  return [...names].map(n => ({ name: n, value: cs.getPropertyValue(n).trim() }));
}

const FIG_BY_CHECK = [['grid', 'grid'], ['spacing', 'grid'], ['inset', 'inset'], ['family', 'fonts'], ['radius', 'radii'], ['areas', 'areas'], ['overflow', 'structure'], ['color', 'colors'], ['target', 'targets'], ['consistency', 'cons'], ['dark', 'dark'], ['lock', 'lock']];
const figKey = rule => rule.fig || (FIG_BY_CHECK.find(([k]) => (rule.checks || []).includes(k)) || [])[1] || ({ R1: 'grid', R2: 'inset', R3: 'fonts', R4: 'radii', R5: 'areas', R6: 'structure', R7: 'colors', R8: 'three', R10: 'targets', R11: 'cons' })[rule.id];
function ruleFigure(rule, ex) {
  const { c, l, bp } = ex.main;
  switch (figKey(rule)) {
    case 'grid': return mini(layerCard('areas', bp), bp.w, bp.h, .64);
    case 'inset': return `<div class="rs-inset">${mini(layerCard('pixels', bp), bp.w, bp.h, .64)}<span>Inset ${S.inset} px</span></div>`;
    case 'fonts': return mini(layerCard('fonts', ex.type.bp), ex.type.bp.w, ex.type.bp.h, .64);
    case 'radii': return `<div class="rs-radii">${[...S.innerRadii, 'card'].map(r => {
      const px = r === 'pill' ? 999 : r === 'card' ? S.radius : r;
      return `<div><i style="border-radius:${px}px${r === 'card' ? ';width:72px' : ''}"></i><span>${r === 'pill' ? 'Pille' : r === 'card' ? `Karte ${S.radius}` : r}</span></div>`;
    }).join('')}</div>`;
    case 'areas': return mini(`<div class="cf-shell cf-layer" style="width:${bp.w}px;height:${bp.h}px">${areaRects(bp)}</div>`, bp.w, bp.h, .64);
    case 'structure': return mini(layerCard('structure', bp), bp.w, bp.h, .64);
    case 'colors': return `<div class="rs-dots">${colorTokens().slice(0, 12).map(t => `<i style="background:${t.value}" title="${esc(t.name)}"></i>`).join('')}</div>`;
    case 'dark': return `<div class="rs-darkfig"><div class="is-ok"><i></i><span>hell</span></div><div class="is-bad"><i></i><span>dunkle Bühne</span></div></div>`;
    case 'targets': {
      const m = S.minTarget || 32;
      const box = (n, cls, label) => `<div class="${cls}"><i style="width:${n}px;height:${n}px"></i><span>${label}</span></div>`;
      return `<div class="rs-targets">${box(Math.max(16, m - 8), 'is-bad', `${Math.max(16, m - 8)} · zu klein`)}${box(m, 'is-ok', `${m} · Minimum`)}${box(m + 12, '', `${m + 12}`)}</div>`;
    }
    case 'cons': {
      const k = F.consistency || {};
      return `<div class="rs-cons"><p><span>Kopfzeile</span><b>${k.style ? esc(k.style.label) : 'keine klare Mehrheit'}</b>${k.style ? `<em>${k.style.count} von ${k.style.of} Layouts</em>` : ''}</p><p><span>Abstand darunter</span><b>${k.gap ? `${k.gap.value} px` : 'keine klare Mehrheit'}</b>${k.gap ? `<em>${k.gap.count} von ${k.gap.of} Layouts</em>` : ''}</p></div>`;
    }
    case 'atoms': return `<div class="rs-atomfig cf-card">${['btn-round', 'btn-pill', 'toggle', 'check'].map(atomById).filter(Boolean).map(a => atomSample(a, a.id === 'btn-round' ? 'solid' : '')).join('')}</div>`;
    case 'three': return `<div class="rs-three">${c.layouts.slice(0, 3).map(x => mini(cardHTML(c, x), x.width, bpOf(c, x).h, .22)).join('')}</div>`;
    default: return `<span class="rs-none">${esc(rule.id)}</span>`;
  }
}

/* ---------- Regeln live anpassen ---------- */
// Änderungen wirken sofort auf window.SYSTEM; alle Layouts werden neu gemessen (Was-wäre-wenn).
// „Übernehmen“ schreibt factory/system.js über tools/serve.mjs, „Verwerfen“ stellt den geladenen Stand wieder her.
const SYS0 = JSON.stringify(window.SYSTEM);
const OK0 = { ok: null, total: null };
let rulesEdit = false;
const DIFF_NAMES = { spacing: 'Abstandsskala', lineHeightRatios: 'Zeilenhöhen', minTarget: 'Trefferflächen', unit: 'Raster', inset: 'Inset', radius: 'Kartenradius', innerRadii: 'innere Radien', typeScale: 'Schriftskala', lineHeightStep: 'Zeilenhöhen', 'limits.sizes': 'Größen je Layout', 'limits.weights': 'Schnitte je Layout', 'limits.families': 'Familien je Layout', rules: 'Regeln (Texte, Stufen)' };
const getPath = p => p.split('.').reduce((o, k) => o?.[k], S);
// Platzhalter wie {unit} oder {limits.sizes} in Regeltexten durch die aktuellen Werte ersetzen
const fillRule = t => String(t).replace(/\{([a-zA-Z.]+)\}/g, (m, p) => { const v = getPath(p); return v == null ? m : Array.isArray(v) ? v.map(x => (x === 'pill' ? 'Pille' : x)).join(', ') : String(v); });
const setPath = (p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((o, k) => o[k], S)[last] = v; };
function systemDiff() {
  const A = JSON.parse(SYS0), out = [];
  for (const k of ['unit', 'inset', 'radius', 'innerRadii', 'typeScale', 'lineHeightStep', 'lineHeightRatios', 'spacing', 'minTarget']) if (JSON.stringify(A[k]) !== JSON.stringify(S[k])) out.push(k);
  for (const k of ['sizes', 'weights', 'families']) if (A.limits[k] !== S.limits[k]) out.push(`limits.${k}`);
  if (JSON.stringify(A.rules) !== JSON.stringify(S.rules)) out.push('rules');
  return out;
}
function applySystem() {
  U = S.unit;
  document.documentElement.style.setProperty('--cf-radius', `${S.radius}px`);
  measureAll();
  renderSummary();
}
const layoutCounts = () => { const all = Object.values(F.bps); return { ok: all.filter(b => b.ok).length, total: all.length }; };

function ruleControls(rule) {
  const pick = (path, label, opts, fmt) => `<div class="rs-ctl"><span>${label}</span>${seg(`sys:${path}`, getPath(path), opts.map(v => [v, fmt ? fmt(v) : String(v)]))}</div>`;
  const chips = (path, label, opts, fmt) => `<div class="rs-ctl"><span>${label}</span><div class="rs-chips">${opts.map(v => `<button type="button" data-chip="${path}" data-v="${v}"${getPath(path).includes(v) ? ' class="on"' : ''}>${fmt ? fmt(v) : v}</button>`).join('')}</div></div>`;
  const CTL = {
    unit: () => pick('unit', 'Raster', [1, 2, 4, 8, 12, 16], v => (v === 1 ? 'aus' : `${v} px`)),
    inset: () => pick('inset', 'Inset', [8, 12, 16, 20, 24, 32, 40], v => `${v} px`),
    limits: () => pick('limits.sizes', 'Größen je Layout', [2, 3, 4, 5]) + pick('limits.weights', 'Schnitte je Layout', [1, 2, 3, 4]) + pick('limits.families', 'Familien je Layout', [1, 2, 3]),
    typeScale: () => chips('typeScale', 'Schriftskala', [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 40, 42, 46, 48, 54, 56, 64, 72]),
    lineHeightStep: () => pick('lineHeightStep', 'Zeilenhöhen', [4, 8], v => `× ${v}`),
    lineHeightRatios: () => chips('lineHeightRatios', 'Zeilenhöhe (Faktor)', [1, 1.1, 1.2, 1.25, 1.3, 1.4, 1.5, 1.6]),
    radius: () => pick('radius', 'Kartenradius', [0, 2, 4, 8, 12, 16, 20, 24, 32], v => `${v}`),
    innerRadii: () => chips('innerRadii', 'Innere Radien', [0, 2, 4, 8, 12, 16, 24, 'pill'], v => (v === 'pill' ? 'Pille' : v)),
    minTarget: () => pick('minTarget', 'Mindestgröße', [24, 32, 40, 44, 48], v => `${v} px`),
    spacing: () => chips('spacing', 'Abstandsskala', [2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64]),
  };
  const legacy = { R1: ['unit'], R2: ['inset'], R3: ['limits', 'typeScale', 'lineHeightStep'], R4: ['radius', 'innerRadii'], R10: ['minTarget'] };
  return (rule.ctl || legacy[rule.id] || []).filter(k => CTL[k] && getPath(k === 'limits' ? 'limits.sizes' : k) != null).map(k => CTL[k]()).join('');
}

function draftBar() {
  const d = systemDiff();
  if (!d.length) return '';
  const now = layoutCounts(), bad = now.total - now.ok, bad0 = OK0.total - OK0.ok;
  return `<div class="rs-draft" id="rs-draft" role="status">
    <div class="rs-dtext"><b>Entwurf</b> · geändert: ${d.map(k => DIFF_NAMES[k] || k).join(', ')}<br>
      <span class="${bad > bad0 ? 'is-bad' : 'is-ok'}">${bad ? `${bad} von ${now.total} Layouts verstoßen dann gegen die Regeln` : `alle ${now.total} Layouts bleiben im Raster`}</span>${bad !== bad0 ? ` <em>(jetzt ${bad0})</em>` : ''}</div>
    <div class="rs-dact"><button type="button" class="cf-btn" data-a="sys-discard">Verwerfen</button><button type="button" class="cf-btn is-primary" data-a="sys-apply"${F.live ? '' : ' disabled title="Nur mit tools/serve.mjs"'}>Übernehmen</button></div>
  </div>`;
}
function refreshDraft() {
  document.getElementById('rs-draft')?.remove();
  main.querySelector('.v-rules')?.insertAdjacentHTML('beforeend', draftBar());
  bindDraft();
}
function bindDraft() {
  main.querySelector('[data-a="sys-discard"]')?.addEventListener('click', () => {
    const A = JSON.parse(SYS0);
    Object.keys(A).forEach(k => { S[k] = A[k]; });
    applySystem();
    viewRules(true);
  });
  main.querySelector('[data-a="sys-apply"]')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Speichert …';
    const system = { ...S, version: /^\d+$/.test(S.version) ? String(+S.version + 1) : S.version };
    try {
      const r = await fetch('/api/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: SYS_ID, system, message: systemDiff().map(k => DIFF_NAMES[k] || k).join(', ') }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Fehler ${r.status}`);
      btn.textContent = 'Übernommen – lädt neu …';
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Übernehmen';
      document.querySelector('.rs-dtext')?.insertAdjacentHTML('beforeend', `<br><span class="is-bad">${esc(err.message)}</span>`);
    }
  });
}

function violationsPrompt() {
  const lines = Object.values(F.bps).filter(b => !b.ok).map(b => `- ${b.c} / ${b.l}: ${b.violations.map(v => `${v.rule}: ${v.msg}`).join('; ')}`);
  return `Aktives Regelwerk: ${S.name} (${SYS_JS}). Die Regeln darin wurden geändert oder Komponenten verstoßen dagegen. Passe alle betroffenen Komponenten an die aktuellen Regeln an, ohne ihren Charakter zu verändern; gesperrte Flächen (locks in components/<id>.tweaks.js) nicht anfassen. Aktuelle Verstöße:
${lines.join('\n')}
Prüfe danach mit node tools/check.mjs, bis alles ✓ ist.`;
}
function checkPrompt(rule) {
  return `Baue für die Regel ${rule.id} „${fillRule(rule.title)}“ aus ${SYS_JS} eine automatische Prüfung. Regeltext: ${fillRule(rule.text)}
Ergänze dazu in measure() in factory/factory.js eine Messung mit V('<kürzel>', '<Meldung auf Deutsch>') und trage das Kürzel in checks dieser Regel in ${SYS_JS} ein. Die Messung soll am gerenderten DOM arbeiten wie die übrigen. Lass danach node tools/check.mjs laufen und berichte, welche Komponenten die neue Regel verletzen – ändere die Komponenten selbst noch nicht.`;
}

/* ---------- Regeln → Bausteine ---------- */
// Übersicht der Bausteine (atoms in system.js) mit allen Varianten, ihrer Verwendung und den Eigenbauten, die die Messung findet.
function ownGroups(all) {
  const map = new Map();
  for (const x of all) for (const o of x.bp.own || []) {
    const key = `${x.c.id}|${o.kind}|${o.sel}`;
    if (!map.has(key)) map.set(key, { key, c: x.c, l: x.l, kind: o.kind, sel: o.sel, label: o.label, suggest: o.suggest, html: o.html, w: o.w, h: o.h, sizes: new Set(), layouts: [], msgs: [] });
    const g = map.get(key);
    g.sizes.add(o.kind === 'size' ? `${o.h} px hoch` : `${o.w} × ${o.h}`);
    if (!g.layouts.includes(x.l.name)) g.layouts.push(x.l.name);
    g.msgs.push(o.msg);
  }
  return [...map.values()];
}
const OWN_KIND = { control: 'Bedienelement', progress: 'Fortschritt', icon: 'Icon', size: 'Größe' };
const iconName = g => (g.html.match(/data-icon="([^"]+)"/) || [])[1] || 'ohne Namen';
function ownSwitchPrompt(groups) {
  const byC = new Map();
  groups.filter(g => g.kind !== 'icon').forEach(g => { if (!byC.has(g.c.id)) byC.set(g.c.id, []); byC.get(g.c.id).push(g); });
  const icons = groups.filter(g => g.kind === 'icon');
  const line = g => {
    const a = atomById(g.suggest);
    return `- ${g.sel} („${g.label}“, ${[...g.sizes].join(', ')}, Layouts ${g.layouts.join(', ')}) → ${a ? `${a.name} ${a.match}` : 'passender Baustein'}${g.kind === 'size' ? ' in einer Größe, die der Baustein kennt' : ''}`;
  };
  return `Stelle Eigenbauten auf die Bausteine des aktiven Regelwerks um (atoms in ${SYS_JS}, CSS in ${SYS_CSS}; dieselben Klassen gibt es in allen Regelwerken).
${[...byC].map(([id, gs]) => `components/${id}.js:\n${gs.map(line).join('\n')}`).join('\n')}${icons.length ? `\nEigene Icons: ${icons.map(g => `„${iconName(g)}“ in components/${g.c.id}.js`).join(', ')} – über h.icon nehmen, fehlt eins im Icon-Satz, nimm das nächste passende und nenne es am Ende.` : ''}
Form und Höhe kommen aus dem Baustein (passende Variante wählen, z. B. .lg für 48 px); komponentenspezifische Farben und Abstände dürfen bleiben. Verhalten und Hover-Stile erhalten, danach nicht mehr benutztes CSS entfernen. Fehlt eine Größe oder Form im Baustein, nimm die nächste passende Variante und nenne das am Ende. Prüfe mit node tools/check.mjs <id> --states --system ${SYS_ID} und sieh dir die Screenshots an.`;
}
function ownAdoptPrompt(g) {
  if (g.kind === 'icon') {
    const n = iconName(g);
    return `Nimm das Icon „${n}“ aus components/${g.c.id}.js in den Icon-Satz auf: ICONS in factory/factory.js (24er viewBox, Linien mit stroke 1.6 wie die übrigen) und die Icon-Liste in CLAUDE.md. Ersetze danach das eigene SVG in der Komponente durch h.icon('${n}', …). Prüfe mit node tools/check.mjs ${g.c.id} --system ${SYS_ID}.`;
  }
  const a = atomById(g.suggest);
  return `Nimm den Eigenbau ${g.sel} („${g.label}“, ${[...g.sizes].join(', ')}) aus components/${g.c.id}.js als Baustein auf. Ergänze in ALLEN Regelwerken (systems/*/system.js unter atoms, CSS in systems/*/system.css) eine Variante eines bestehenden Bausteins${a ? ` (naheliegend: ${a.name} ${a.match})` : ''} oder einen neuen Baustein – mit id, name, match, use, variants und sample wie die übrigen, Farben nur als Tokens, im ZDS-Regelwerk mit den ZDS-Radien und -Abständen. Stelle danach die Komponente auf den Baustein um und entferne ihr eigenes CSS dafür. Prüfe mit node tools/check.mjs --system fabrik und node tools/check.mjs --system zds.`;
}
function atomsHTML(all) {
  const A = S.atoms || [];
  if (!A.length) return `<p class="rs-pn">Dieses Regelwerk hat noch keine Bausteine (<code>atoms</code> in <code>${SYS_JS}</code>).</p>`;
  const sizes = atomSizes();
  const use = new Map();
  for (const x of all) for (const u of x.bp.atomUse || []) {
    if (!use.has(u.atom)) use.set(u.atom, { n: 0, layouts: new Set(), comps: new Map(), vars: new Map() });
    const e = use.get(u.atom);
    e.n++; e.layouts.add(`${x.c.id}/${x.l.id}`); e.comps.set(x.c.name, (e.comps.get(x.c.name) || 0) + 1);
    (u.vars.length ? u.vars : ['']).forEach(v => e.vars.set(v, (e.vars.get(v) || 0) + 1));
  }
  const groups = ownGroups(all);
  const card = a => {
    const e = use.get(a.id);
    const vs = ['', ...Object.keys(a.variants || {})];
    return `<article class="rs-atom" id="baustein-${esc(a.id)}">
      <div class="rs-atomstage cf-card">${vs.map(v => `<figure><div class="rs-atomcell">${atomSample(a, v)}</div><figcaption>${v ? esc(a.variants[v]) : 'Standard'}${v ? `<code>.${esc(v)}</code>` : ''}${e?.vars.get(v) ? `<em>${e.vars.get(v)}×</em>` : ''}</figcaption></figure>`).join('')}</div>
      <div class="rs-atombody">
        <h3 class="rs-atomname">${esc(a.name)} <code>${esc(a.match)}</code></h3>
        <p class="rs-atomtext">${codeText(a.use || '')}</p>
        <p class="rs-atommeta">${e ? `${e.n}× in ${e.layouts.size} Layouts · ${[...e.comps].sort((p, q) => q[1] - p[1]).map(([n, k]) => `${esc(n)} ${k}`).join(' · ')}` : 'noch nicht verwendet'}${a.control !== false && sizes[a.id]?.size ? ` · Höhen ${[...sizes[a.id]].sort((p, q) => p - q).join(' · ')} px` : ''}</p>
      </div>
    </article>`;
  };
  const icons = Object.keys(ICONS);
  return `<p class="rs-pn">${A.length} Bausteine in <code>${SYS_CSS}</code>, beschrieben unter <code>atoms</code> in <code>${SYS_JS}</code>. Claude baut Bedienelemente nur daraus; Farbe und Abstand darf eine Komponente anpassen, Form und Höhe nicht. Die Regel ${esc((S.rules.find(r => r.checks.includes('atoms')) || {}).id || '')} misst das.</p>
    <div class="rs-atoms">${A.map(card).join('')}
      <article class="rs-atom rs-atom-icons" id="baustein-icons">
        <div class="rs-atomstage cf-card rs-iconset">${icons.map(n => `<span title="${esc(n)}">${icon(n, 20)}<small>${esc(n)}</small></span>`).join('')}</div>
        <div class="rs-atombody"><h3 class="rs-atomname">Icons <code>h.icon(name, größe)</code></h3><p class="rs-atomtext">${icons.length} Linien-Icons, 24er Raster, Strich 1,6. In Figma kommen sie im ZDS-Regelwerk aus der Library ZDS-Icons, soweit es dort ein gleiches gibt.</p></div>
      </article>
    </div>
    <div class="rs-own" id="eigenbauten">
      <div class="rs-ownhead">
        <h3 class="rs-ph">Eigenbauten <span class="cf-badge ${groups.length ? 'warn' : 'ok'}">${groups.length || 'keine'}</span></h3>
        ${groups.length && F.live ? `<button type="button" class="cf-btn" data-a="own-all">Alle auf Bausteine umstellen lassen</button>` : ''}
      </div>
      <p class="rs-pn">${groups.length ? 'Bedienelemente, Balken und Icons, die eine Komponente selbst gebaut hat, und Bausteine in einer Größe, die es nicht gibt. Entweder auf den Baustein umstellen oder, wenn die Form gebraucht wird, als Baustein aufnehmen – dann steht sie allen Komponenten zur Verfügung.' : 'Alle Bedienelemente, Balken und Icons kommen aus den Bausteinen.'}</p>
      <div class="b-log ed-log rs-ownlog" data-ownlog="all"></div>
      ${groups.length ? `<ul class="rs-ownlist">${groups.map((g, i) => {
        const a = atomById(g.suggest);
        return `<li class="rs-ownitem">
          <div class="rs-ownstage cf-card" data-c="${esc(g.c.id)}" data-l="${esc(g.l.id)}" data-w="${g.w}" data-h="${g.h}">${g.html}</div>
          <div class="rs-ownbody">
            <p class="rs-ownname"><b>${esc(g.c.name)}</b> · ${g.kind === 'icon' ? `Icon „${esc(iconName(g))}“` : g.kind === 'progress' ? `<code>${esc(g.sel)}</code>` : `<code>${esc(g.sel)}</code> „${esc(g.label)}“`}</p>
            <p class="rs-ownmeta">${OWN_KIND[g.kind]} · ${esc([...g.sizes].join(', '))} · ${g.layouts.length === 1 ? `Layout ${esc(g.layouts[0])}` : `${g.layouts.length} Layouts`}${a ? ` · passt zu <a href="#baustein-${esc(a.id)}">${esc(a.name)}</a>` : ''}</p>
          </div>
          <div class="rs-ownact">
            <button type="button" class="cf-btn" data-own="${i}" data-act="switch">${g.kind === 'size' ? 'Größe angleichen' : g.kind === 'icon' ? 'Vorhandenes Icon nehmen' : 'Auf Baustein umstellen'}</button>
            ${g.kind !== 'size' ? `<button type="button" class="cf-btn" data-own="${i}" data-act="adopt">${g.kind === 'icon' ? 'In den Icon-Satz' : 'Als Baustein aufnehmen'}</button>` : ''}
          </div>
          <div class="b-log ed-log rs-ownlog" data-ownlog="${i}"></div>
        </li>`;
      }).join('')}</ul>` : ''}
    </div>`;
}
function bindAtoms(all) {
  const groups = ownGroups(all);
  main.querySelectorAll('.rs-ownstage').forEach(st => {
    const el = st.firstElementChild, w = +st.dataset.w, h = +st.dataset.h;
    if (!el || !w || !h) return;
    const k = Math.min(1, (st.clientWidth - 16) / w, (st.clientHeight - 16) / h);
    Object.assign(el.style, { position: 'relative', inset: 'auto', margin: '0', flex: 'none', whiteSpace: 'nowrap', width: `${w}px`, height: `${h}px`, zoom: String(k) });
  });
  const run = (prompt, log) => {
    if (!F.live) return copyHint(log, 'Anweisung für Claude Code', prompt);
    main.querySelectorAll('.rs-own button').forEach(b => { b.disabled = true; });
    generate(prompt, { log, view: 'rules' });
  };
  main.querySelector('[data-a="own-all"]')?.addEventListener('click', () => run(ownSwitchPrompt(groups), main.querySelector('[data-ownlog="all"]')));
  main.querySelectorAll('[data-own]').forEach(b => b.addEventListener('click', () => {
    const g = groups[+b.dataset.own];
    run(b.dataset.act === 'adopt' ? ownAdoptPrompt(g) : ownSwitchPrompt([g]), main.querySelector(`[data-ownlog="${b.dataset.own}"]`));
  }));
}

/* ---------- Regeln → Gelernt ---------- */
// Was Claude aus den Rückmeldungen ableitet: Leitsätze (feedback/leitsaetze.js) mit ihren Belegen,
// die Entscheidungen zu Varianten (feedback/praeferenzen.js), akzeptierte Ausnahmen und Feinschliff.
// Ein Leitsatz gilt erst, wenn ihr ihn bestätigt; bestätigte lassen sich zu einer Regel machen.
const LS_STATUS = { vorschlag: 'Vorschlag', bestaetigt: 'Bestätigt', regel: 'Jetzt Regel', verworfen: 'Verworfen' };
const fbKey = e => `${e.c}/${e.l}`;
function belegLabel(key) {
  const ex = key.match(/^ausnahme:([a-z0-9-]+)\/([a-z0-9-]+)\/(.+)$/);
  if (ex) { const c = F.byId[ex[1]]; return `Ausnahme ${ex[3]} in ${c?.name || ex[1]} · ${c?.layouts.find(l => l.id === ex[2])?.name || ex[2]}`; }
  const fb = (window.CF_FEEDBACK || []).find(e => fbKey(e) === key);
  if (fb) return `${F.byId[fb.c]?.name || fb.c} · ${fb.name || dirName(fb.direction)} ${fb.decision}${fb.comment ? ` („${fb.comment}“)` : ''}`;
  const tw = key.match(/^feinschliff:([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/);
  if (tw) return `Feinschliff in ${F.byId[tw[1]]?.name || tw[1]}${tw[2] ? ` · ${F.byId[tw[1]]?.layouts.find(l => l.id === tw[2])?.name || tw[2]}` : ''}`;
  return key;
}
function exceptionPatterns() {
  const map = new Map();
  for (const [cid, lays] of Object.entries(F.tw)) for (const [lid, t] of Object.entries(lays || {})) for (const e of t?.exceptions || []) {
    const sys = e.system || 'alle';
    const k = `${sys}|${e.rule}`;
    if (!map.has(k)) map.set(k, { sys, code: e.rule, items: [] });
    map.get(k).items.push({ c: F.byId[cid]?.name || cid, l: F.byId[cid]?.layouts.find(x => x.id === lid)?.name || lid, reason: e.reason || '' });
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length);
}
function tweakSummary() {
  const out = [];
  for (const c of F.components) {
    const lays = Object.entries(F.tw[c.id] || {}).filter(([, t]) => t && (Object.keys(t.el || {}).length || Object.keys(t.text || {}).length || t.height));
    if (lays.length) out.push({ c, n: lays.length, names: lays.map(([lid]) => c.layouts.find(l => l.id === lid)?.name || lid) });
  }
  return out;
}
function learnPrompt() {
  return `Leite aus den Rückmeldungen des Teams Leitsätze ab und schreibe sie nach feedback/leitsaetze.js (Format, Felder und Kommentare wie in der Datei; der Inhalt nach „window.CF_LEITSAETZE =“ bleibt gültiges JSON).
Quellen: feedback/praeferenzen.js (behaltene und verworfene Varianten, mit Kommentar und idea der Variante), exceptions und Feinschliff (el, text, height) in components/*.tweaks.js, dazu die betroffenen Komponenten in components/<id>.js und das Regelwerk ${SYS_JS}.
- Ein Leitsatz ist eine konkrete Handlungsregel in einem Satz („Listentitel bleiben in der Oberflächenschrift …“), kein Protokoll. titel: zwei bis fünf Wörter.
- Nur, was die Belege tragen. Jeder Leitsatz nennt seine Belege (Schlüssel wie in der Datei beschrieben) und in warum einen Halbsatz, woraus er folgt.
- Leitsätze mit status bestaetigt, regel oder verworfen nicht ändern; verworfene nicht neu vorschlagen. Neue mit status vorschlag, nächster freier id (L1, L2 …), seit = heute. Widerspricht ein Beleg einem bestätigten Leitsatz, schlag einen Ersatz vor und sag es in warum.
- system: null, wenn er für alle Regelwerke gilt, sonst die id des Regelwerks.
- Ändere keine Komponenten und keine Regelwerke.
Zum Schluss ein Satz, was neu ist. Letzte Zeile: ID: -`;
}
function learnedHTML(all) {
  const LS = window.CF_LEITSAETZE || [];
  const fb = window.CF_FEEDBACK || [];
  const live = LS.filter(x => x.status !== 'verworfen');
  const dropped = LS.filter(x => x.status === 'verworfen');
  const draft = systemDiff().length > 0;
  const sysName = id => (window.CF_SYSTEMS || []).find(x => x.id === id)?.name || id;
  const ls = x => `<article class="rs-ls is-${esc(x.status)}" id="leitsatz-${esc(x.id)}">
      <p class="rs-lstop"><span class="rs-lsst">${esc(LS_STATUS[x.status] || x.status)}</span><span>${esc(x.id)} · ${x.system ? esc(sysName(x.system)) : 'alle Regelwerke'} · seit ${esc(x.seit || '')}</span></p>
      <h3 class="rs-lstitle">${esc(x.titel || '')}</h3>
      <p class="rs-lstext">${codeText(x.text)}</p>
      ${x.warum ? `<p class="rs-lswhy">${esc(x.warum)}</p>` : ''}
      <p class="rs-lsbel">${(x.belege || []).length} ${(x.belege || []).length === 1 ? 'Beleg' : 'Belege'}: ${(x.belege || []).map(b => esc(belegLabel(b))).join(' · ')}</p>
      <div class="rs-lsact">${x.status === 'vorschlag' ? `<button type="button" class="cf-btn is-primary" data-ls="${esc(x.id)}" data-lsa="confirm">${icon('check', 14)}Bestätigen</button><button type="button" class="cf-btn" data-ls="${esc(x.id)}" data-lsa="drop">Verwerfen</button>`
        : x.status === 'bestaetigt' ? `<button type="button" class="cf-btn" data-ls="${esc(x.id)}" data-lsa="rule"${draft ? ' disabled title="Erst den Entwurf der Regeln übernehmen oder verwerfen"' : ''}>Zur Regel in ${esc(S.name)} machen</button><button type="button" class="cf-btn" data-ls="${esc(x.id)}" data-lsa="unconfirm">Zurücknehmen</button>`
        : x.status === 'regel' && x.regel ? `<a class="cf-btn" href="#regel-${esc(String(x.regel).split(':').pop())}">Zur Regel ${esc(String(x.regel).split(':').pop())}</a>` : ''}</div>
    </article>`;
  const by = new Map();
  fb.forEach(e => { const k = e.direction || 'ohne Richtung'; const x = by.get(k) || { keep: 0, drop: 0 }; e.decision === 'behalten' ? x.keep++ : x.drop++; by.set(k, x); });
  const pats = exceptionPatterns(), tws = tweakSummary();
  const fmtDay = d => (d ? d.split('-').reverse().slice(0, 2).join('.') + '.' : '');
  return `<p class="rs-pn">Was Claude aus euren Rückmeldungen ableitet: Entscheidungen zu Varianten, akzeptierte Ausnahmen, Feinschliff. Ein Leitsatz gilt erst, wenn ihr ihn bestätigt – dann liest Claude ihn vor jeder Arbeit wie eine Soll-Regel. Wird er wichtig genug, macht ihr ihn zur Regel.</p>
    <div class="rs-lshead">${F.live ? `<button type="button" class="cf-btn" data-a="learn">${icon('refresh', 14)}Leitsätze neu ableiten</button>` : ''}<span class="rs-lsnote">${live.length ? (n => `${n} ${n === 1 ? 'Vorschlag' : 'Vorschläge'}`)(live.filter(x => x.status === 'vorschlag').length) + ` · ${live.filter(x => x.status === 'bestaetigt').length} bestätigt · ${live.filter(x => x.status === 'regel').length} als Regel` : 'Noch keine Leitsätze.'}</span></div>
    <div class="b-log ed-log rs-learnlog"></div>
    ${live.length ? `<div class="rs-lslist">${live.map(ls).join('')}</div>` : ''}
    ${dropped.length ? `<details class="rs-lsdrop"><summary>${dropped.length} verworfen</summary>${dropped.map(x => `<p><b>${esc(x.id)}</b> ${esc(x.text)}</p>`).join('')}</details>` : ''}
    <div class="rs-learngrid">
      <div class="rs-panel">
        <h3 class="rs-ph">Entscheidungen zu Varianten</h3>
        ${fb.length ? `<div class="rs-prefs">${[...by].sort((a, b) => (b[1].keep - b[1].drop) - (a[1].keep - a[1].drop)).map(([k, x]) => `<div class="rs-pref"><b>${esc(dirName(k))}</b><span class="is-ok">${x.keep} behalten</span><span class="is-bad">${x.drop} verworfen</span></div>`).join('')}</div>
          <ul class="rs-prefnotes">${fb.slice().reverse().map(e => `<li><span class="${e.decision === 'behalten' ? 'is-ok' : 'is-bad'}">${e.decision}</span> ${esc(fmtDay(e.when))} ${esc(F.byId[e.c]?.name || e.c)} · ${esc(e.name || dirName(e.direction))}${e.comment ? `: „${esc(e.comment)}“` : ''}</li>`).join('')}</ul>`
          : '<p class="rs-pn">Noch keine. Behalte oder verwirf Varianten in „Layouts“ – daraus lernt Claude, welche Richtungen ihr mögt.</p>'}
      </div>
      <div class="rs-panel">
        <h3 class="rs-ph">Akzeptierte Ausnahmen</h3>
        ${pats.length ? `<ul class="rs-prefnotes">${pats.map(p => `<li><b>${esc(ruleOf(p.code)?.id || p.code)}</b> ${p.items.length}× ${p.sys !== 'alle' ? `(${esc(sysName(p.sys))})` : ''}${p.items.length >= 3 ? ' <span class="is-bad">– Regel überdenken?</span>' : ''}<br><span class="rs-pnsmall">${p.items.map(i => `${esc(i.c)} · ${esc(i.l)}${i.reason ? `: ${esc(i.reason)}` : ''}`).join(' · ')}</span></li>`).join('')}</ul>`
          : '<p class="rs-pn">Keine. Wer in „Schichten“ eine Abweichung bewusst annimmt, taucht hier auf; dreimal dieselbe heißt meist, dass die Regel nicht passt.</p>'}
      </div>
      <div class="rs-panel">
        <h3 class="rs-ph">Feinschliff von Hand</h3>
        ${tws.length ? `<ul class="rs-prefnotes">${tws.map(t => `<li><b>${esc(t.c.name)}</b> ${t.n} ${t.n === 1 ? 'Layout' : 'Layouts'}<br><span class="rs-pnsmall">${t.names.map(esc).join(' · ')}</span></li>`).join('')}</ul><p class="rs-pnsmall">Handkorrekturen zeigen, wo Claude danebenlag. Die Ableitung liest sie mit.</p>`
          : '<p class="rs-pn">Kein offener Feinschliff.</p>'}
      </div>
    </div>`;
}
async function leitsatzAction(id, action) {
  const LS = window.CF_LEITSAETZE || [];
  const x = LS.find(l => l.id === id);
  if (!x) return;
  const body = { id, action };
  if (action === 'rule') {
    const prefix = (S.rules[S.rules.length - 1]?.id || 'R').replace(/\d+$/, '') || 'R';
    const n = Math.max(0, ...S.rules.map(r => +String(r.id).replace(/\D/g, '') || 0)) + 1;
    const rid = `${prefix}${n}`;
    const system = { ...S, version: /^\d+$/.test(S.version) ? String(+S.version + 1) : S.version, rules: [...S.rules, { id: rid, title: x.titel || x.text.split(/[.:–]/)[0].slice(0, 40), checks: [], level: 'soll', text: x.text }] };
    Object.assign(body, { rule: rid, systemId: SYS_ID, system });
  }
  if (!F.live) { toast('Nur mit tools/serve.mjs – die Seite ist nicht mit dem Server verbunden.', true); return; }
  try {
    const r = await fetch('/api/leitsatz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || `Fehler ${r.status}`);
    window.CF_LEITSAETZE = j.list;
    toast(action === 'confirm' ? `${id} bestätigt – Claude richtet sich ab jetzt danach.` : action === 'drop' ? `${id} verworfen.` : action === 'unconfirm' ? `${id} ist wieder ein Vorschlag.` : `${id} ist jetzt Regel ${body.rule} – lädt neu …`);
    if (action !== 'rule') viewRules(true);
  } catch (err) { toast(err.message, true); }
}
function bindLearned() {
  main.querySelectorAll('[data-lsa]').forEach(b => b.addEventListener('click', () => { b.disabled = true; leitsatzAction(b.dataset.ls, b.dataset.lsa); }));
  main.querySelector('[data-a="learn"]')?.addEventListener('click', e => {
    e.currentTarget.disabled = true;
    generate(learnPrompt(), { log: main.querySelector('.rs-learnlog'), view: 'rules' });
  });
}

function viewRules(keepScroll) {
  const y = scrollY;
  if (OK0.total == null || !systemDiff().length) Object.assign(OK0, layoutCounts());
  const all = F.components.flatMap(c => c.layouts.map(l => ({ c, l, bp: bpOf(c, l) })));
  const pick = pred => all.find(pred) || all[0];
  const ex = {
    main: pick(x => x.bp.ok && x.bp.areas.length >= 3 && x.bp.media.length) || pick(x => x.bp.areas.length >= 3),
    type: pick(x => x.bp.type.families.length > 1),
  };
  const measured = S.rules.filter(r => r.checks.length);
  const okAll = all.filter(x => x.bp.ok).length;
  const L = S.limits;
  const draft = systemDiff().length > 0;
  const facts = [
    U > 1 ? ['Raster', `${U} px`] : ['Abstände', `${S.spacing.length} Stufen`], ['Inset', `${S.inset} px`], ['Kartenradius', `${S.radius} px`], ['Breite', `${S.width} px`],
    ['Familien', `${L.families}`], ['Größen je Layout', `max. ${L.sizes}`], ['Schnitte je Layout', `max. ${L.weights}`],
  ];
  const ruleHTML = (rule, idx) => {
    let state;
    if (!rule.checks.length) state = '<span class="cf-badge rs-soft">Nicht gemessen · Blick von Claude und dir</span>';
    else if (!all.length) state = '';
    else {
      const pool = x => (rule.level === 'soll' ? x.bp.warnings || [] : x.bp.violations);
      const bad = all.filter(x => pool(x).some(v => rule.checks.includes(v.rule)));
      const acc = all.reduce((n, x) => n + (x.bp.accepted || []).filter(v => rule.checks.includes(v.rule)).length, 0);
      const accTag = acc ? `<span class="cf-badge rs-soft">${acc} ${acc === 1 ? 'Ausnahme' : 'Ausnahmen'}</span>` : '';
      state = bad.length
        ? `<span class="cf-badge ${rule.level === 'soll' ? 'warn' : 'bad'}">${all.length - bad.length}/${all.length} Layouts</span>${accTag}${bad.map(x => `<button class="rs-bad" data-c="${esc(x.c.id)}" data-li="${x.l.index}">${esc(x.c.name)} · ${esc(x.l.name)}</button>`).join('')}`
        : `<span class="cf-badge ok">${icon('check', 14)}${all.length}/${all.length} Layouts</span>${accTag}`;
    }
    const edit = rulesEdit;
    return `<article class="rs-rule${edit ? ' is-edit' : ''}" id="regel-${esc(rule.id)}">
      <div class="rs-fig">${all.length ? ruleFigure(rule, ex) : ''}</div>
      <div class="rs-body">
        <p class="rs-id">${esc(rule.id)} · ${rule.checks.length ? 'gemessen' : 'Gestaltung'} · <span class="rs-level ${rule.level === 'soll' ? 'is-soll' : 'is-muss'}">${rule.level === 'soll' ? 'Soll' : 'Muss'}</span></p>
        ${edit ? `<input class="rs-title-in" id="rs-title-${esc(rule.id)}" data-rule="${idx}" data-f="title" value="${esc(rule.title)}" aria-label="Titel der Regel">` : `<h2 class="rs-title">${esc(fillRule(rule.title))}</h2>`}
        ${edit ? `<textarea class="rs-text-in" id="rs-text-${esc(rule.id)}" data-rule="${idx}" data-f="text" rows="3" aria-label="Text der Regel">${esc(rule.text)}</textarea>` : `<p class="rs-text">${codeText(fillRule(rule.text))}</p>`}
        ${edit ? `<div class="rs-ctls"><div class="rs-ctl"><span>Verbindlichkeit</span>${seg(`lvl:${idx}`, rule.level === 'soll' ? 'soll' : 'muss', [['muss', 'Muss – zählt als Verstoß'], ['soll', 'Soll – nur Hinweis']])}</div>${ruleControls(rule)}</div>` : ''}
        <div class="rs-state">${state}</div>
        ${edit && !rule.checks.length ? `<div class="rs-ruleact">
          ${F.live ? `<button type="button" class="cf-btn" data-a="rule-check" data-rule="${idx}"${draft ? ' disabled title="Erst den Entwurf übernehmen"' : ''}>Prüfung von Claude bauen lassen</button>` : ''}
          <button type="button" class="cf-btn" data-a="rule-del" data-rule="${idx}">Regel löschen</button></div><div class="b-log ed-log rs-log" data-log="${idx}"></div>` : ''}
      </div>
    </article>`;
  };
  const tokens = colorTokens();
  const ownN = ownGroups(all).length, lsN = (window.CF_LEITSAETZE || []).filter(x => x.status === 'vorschlag').length;
  main.innerHTML = `<div class="v-rules${rulesEdit ? ' is-editing' : ''}">
  <header class="rs-head">
    <div class="rs-headrow">
      <h1 class="rs-h1">Regeln für alle Komponenten</h1>
      <button type="button" class="cf-btn${rulesEdit ? ' is-primary' : ''}" data-a="rules-edit">${rulesEdit ? `${icon('check', 14)}Fertig` : `${icon('edit', 14)}Regeln anpassen`}</button></div>
    <nav class="rs-nav" aria-label="Abschnitte"><a href="#regeln">Regeln <em>${S.rules.length}</em></a><a href="#bausteine">Bausteine <em>${(S.atoms || []).length}</em>${ownN ? `<b>${ownN} Eigenbauten</b>` : ''}</a><a href="#gelernt">Gelernt${lsN ? `<b>${lsN} ${lsN === 1 ? 'Vorschlag' : 'Vorschläge'}</b>` : ''}</a><a href="#grundwerte">Grundwerte</a></nav>
    ${F.live ? `<div class="rs-syscmp"><button type="button" class="cf-btn" data-a="tok-export">${icon('arrow-up-right', 14)}Tokens exportieren</button><span class="rs-tokout"></span></div>` : ''}
    ${F.live && (window.CF_SYSTEMS || []).length > 1 ? `<div class="rs-syscmp">${(window.CF_SYSTEMS || []).filter(x => x.id !== SYS_ID).map(x => `<button type="button" class="cf-btn" data-syscmp="${esc(x.id)}">${icon('grid', 14)}Mit ${esc(x.name)} vergleichen</button>`).join('')}</div>` : ''}
    <p class="rs-lead">Jede Komponente entsteht in diesem System. ${measured.length} von ${S.rules.length} Regeln misst die Fabrik bei jedem Laden; die übrigen sind Gestaltungsregeln, auf die Claude und du achtet. Aktives Regelwerk: <b>${esc(S.name)}</b>, Quelle ist <code>${SYS_JS}</code> – dieselbe Datei, nach der Claude baut.${rulesEdit ? ' Werte ändern wirkt sofort: Alle Layouts werden neu gemessen, gespeichert wird erst mit „Übernehmen“.' : ''}</p>
    <dl class="rs-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    ${all.length ? `<div class="rs-sum">${okAll === all.length ? `<span class="cf-badge ok">${icon('check', 14)}Alle ${all.length} Layouts erfüllen die gemessenen Regeln</span>` : `<span class="cf-badge bad">${okAll} von ${all.length} Layouts erfüllen die gemessenen Regeln</span>${F.live && !draft ? '<button type="button" class="cf-btn" data-a="fix-all">Verstöße von Claude beheben lassen</button>' : ''}`}<div class="b-log ed-log rs-fixlog"></div></div>` : ''}
  </header>
  <section class="rs-rules rs-sec" id="regeln">${S.rules.map(ruleHTML).join('')}${rulesEdit ? `<button type="button" class="cf-btn rs-add" data-a="rule-add">${icon('plus', 14)}Neue Regel</button>` : ''}</section>
  <section class="rs-sec" id="bausteine"><h2 class="rs-h2">Bausteine</h2>${atomsHTML(all)}</section>
  <section class="rs-sec" id="gelernt"><h2 class="rs-h2">Gelernt</h2>${learnedHTML(all)}</section>
  <h2 class="rs-h2 rs-sec" id="grundwerte">Grundwerte</h2>
  <section class="rs-ref">
    <div class="rs-panel rs-wide">
      <h2 class="rs-ph">Schriftskala</h2>
      <p class="rs-pn">Erlaubte Größen mit ihren Klassen. Pro Layout höchstens ${L.sizes} davon, in höchstens ${L.weights} Schnitten.</p>
      ${S.typeScale.map(n => `<div class="rs-type"><span class="rs-tl"><b>${n}</b> / <em data-lh="${n}"></em> · .t-${n}</span><span class="rs-ts t-${n}" style="font-size:${n}px">Raster statt Zufall</span></div>`).join('')}
      <div class="rs-type"><span class="rs-tl"><b>Baskerville</b> · .serif</span><span class="rs-ts t-32 serif">Lass ein wenig Raum für das Unerwartete.</span></div>
    </div>
    <div class="rs-panel rs-wide">
      <h2 class="rs-ph">Textstile</h2>
      <p class="rs-pn">Diese Stile bietet der Bearbeiten-Modus an. Einer ist nur wählbar, solange er die Grenzen pro Layout nicht reißt.</p>
      <div class="rs-styles">${S.textStyles.map(t => `<div class="rs-style"><span class="rs-sn">${esc(t.name)}</span><span class="rs-ss" style="font:${t.weight} ${t.size}px/${t.lh}px ${esc(famCSS(styleFamily(t)))}">${t.size >= 32 ? 'Aa' : 'Raster statt Zufall'}</span><code>${t.size}/${t.lh} · ${t.weight}${t.family ? ' · Baskerville' : ''}</code></div>`).join('')}</div>
    </div>
    <div class="rs-panel">
      <h2 class="rs-ph">Familien</h2>
      ${Object.entries(S.families).map(([f, use]) => `<div class="rs-fam"><span class="rs-fs" style="font-family:${esc(famCSS(f))}">Aa</span><div><b>${esc(f)}</b><span>${esc(use)}</span></div></div>`).join('')}
    </div>
    <div class="rs-panel">
      <h2 class="rs-ph">Flächenrollen</h2>
      <div class="rs-roles">${S.areaRoles.map(r => `<div class="rs-role"><i class="cf-a role-${r}"></i><div><code>${r}</code><span>${esc(ROLE_INFO[r] || '')}</span></div></div>`).join('')}</div>
    </div>
    <div class="rs-panel">
      <h2 class="rs-ph">Abstände</h2>
      ${S.spacing.map(n => `<div class="rs-space"><code>${n}</code><i style="width:${n * 3}px"></i></div>`).join('')}
    </div>
    <div class="rs-panel">
      <h2 class="rs-ph">Radien</h2>
      ${ruleFigure({ fig: 'radii', checks: [] }, ex)}
    </div>
    <div class="rs-panel rs-wide">
      <h2 class="rs-ph">Farben</h2>
      <p class="rs-pn">Nur diese Tokens, eine Akzentfarbe pro Komponente.</p>
      <div class="rs-swatches">${tokens.map(t => `<div class="rs-sw"><i style="background:${t.value}"></i><code>${esc(t.name)}</code><span>${esc(t.value)}</span></div>`).join('')}</div>
    </div>
  </section>
  ${draftBar()}
</div>`;
  main.querySelectorAll('[data-lh]').forEach(em => {
    const s = em.closest('.rs-type').querySelector('.rs-ts');
    em.textContent = parseFloat(getComputedStyle(s).lineHeight);
  });
  main.querySelectorAll('.rs-bad').forEach(b => b.addEventListener('click', () => {
    state.view = 'layers'; state.c = b.dataset.c; state.solo = false; state.l = null;
    state.sel[b.dataset.c] = +b.dataset.li; store.set('sel', state.sel);
    route();
    document.getElementById(`row-${b.dataset.c}`)?.classList.add('show-viol');
  }));
  const rerun = () => { applySystem(); viewRules(true); };
  main.querySelector('[data-a="rules-edit"]').addEventListener('click', () => { rulesEdit = !rulesEdit; viewRules(true); });
  main.querySelectorAll('[data-syscmp]').forEach(b => b.addEventListener('click', () => openSystemsCompare(b.dataset.syscmp)));
  main.querySelector('[data-a="tok-export"]')?.addEventListener('click', async e => { const o = main.querySelector('.rs-tokout'); e.currentTarget.disabled = true; try { o.innerHTML = fileLinks(await runExport('tokens')); } catch (err) { o.textContent = err.message; } e.currentTarget.disabled = false; });
  main.querySelectorAll('[data-seg^="lvl:"]').forEach(b => b.addEventListener('click', () => {
    const r = S.rules[+b.dataset.seg.slice(4)];
    if (b.dataset.v === 'soll') r.level = 'soll'; else delete r.level;
    rerun();
  }));
  main.querySelectorAll('[data-seg^="sys:"]').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.v;
    setPath(b.dataset.seg.slice(4), /^\d+$/.test(v) ? +v : v);
    rerun();
  }));
  main.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', () => {
    const path = b.dataset.chip, raw = b.dataset.v, v = /^-?\d+(\.\d+)?$/.test(raw) ? +raw : raw;
    const list = getPath(path).slice(), i = list.indexOf(v);
    if (i >= 0) { if (list.length > 1) list.splice(i, 1); } else list.push(v);
    list.sort((a, c) => (a === 'pill') - (c === 'pill') || a - c);
    setPath(path, list);
    rerun();
  }));
  main.querySelectorAll('[data-f]').forEach(el => el.addEventListener('input', () => {
    S.rules[+el.dataset.rule][el.dataset.f] = el.value;
    refreshDraft();
  }));
  main.querySelector('[data-a="rule-add"]')?.addEventListener('click', () => {
    const n = Math.max(0, ...S.rules.map(r => +String(r.id).replace(/\D/g, '') || 0)) + 1;
    S.rules.push({ id: `R${n}`, title: 'Neue Regel', checks: [], text: 'Worauf sollen Claude und du achten?' });
    viewRules(true);
    requestAnimationFrame(() => { const t = document.getElementById(`rs-title-R${n}`); t?.focus(); t?.select(); });
  });
  main.querySelectorAll('[data-a="rule-del"]').forEach(b => b.addEventListener('click', () => { S.rules.splice(+b.dataset.rule, 1); viewRules(true); }));
  main.querySelectorAll('[data-a="rule-check"]').forEach(b => b.addEventListener('click', () => {
    const idx = +b.dataset.rule;
    main.querySelectorAll('.rs-rule button, .rs-rule input, .rs-rule textarea').forEach(x => { x.disabled = true; });
    generate(checkPrompt(S.rules[idx]), { log: main.querySelector(`[data-log="${idx}"]`), view: 'rules' });
  }));
  main.querySelector('[data-a="fix-all"]')?.addEventListener('click', e => {
    e.currentTarget.disabled = true;
    generate(violationsPrompt(), { log: main.querySelector('.rs-fixlog'), view: 'rules' });
  });
  bindAtoms(all);
  bindLearned();
  bindDraft();
  if (keepScroll) scrollTo(0, y);
}

/* ---------- Feinschliff: components/<id>.tweaks.js ---------- */
// Alles, was im Bearbeiten-Modus eingestellt wird, landet ohne Claude als Feinschliff in dieser Datei:
// Inline-Stile je Fläche (Größe, Auto-Layout, CSS-order, Rasterplatz), Textstile und -inhalte, Kartenhöhe,
// Sperren und Notizen. Die Fabrik wendet ihn beim Rendern an, die Prüfung misst ihn mit,
// Claude kann ihn später sauber in den Code einarbeiten.
F.tw = {};
F.tweaks = (id, data) => { F.tw[id] = data && typeof data === 'object' ? data : {}; };
const SLOTS = ['cssL', 'cssW', 'cssH', 'cssO', 'cssG'];
const mergedCSS = e => Object.assign({}, ...SLOTS.map(k => e[k] || {}));
const areaSel = name => `[data-area="${CSS.escape(name)}"]`;
const isLeaf = el => !(el instanceof SVGElement) && [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());

function leavesOf(root, area) {
  const scope = area || root;
  const all = [...(area && isLeaf(area) ? [area] : []), ...scope.querySelectorAll('*')];
  return all.filter(el => isLeaf(el) && (el.closest('[data-area]') || null) === (area || null));
}
function textKeyOf(card, el) {
  const area = el.closest('[data-area]');
  const own = area && card.contains(area) ? area : null;
  const i = leavesOf(card, own).indexOf(el);
  return i < 0 ? null : `${own ? own.dataset.area : ''}>${i}`;
}
function resolveText(root, key) {
  const j = key.lastIndexOf('>'), name = key.slice(0, j), i = +key.slice(j + 1);
  const area = name ? root.querySelector(areaSel(name)) : null;
  if (name && !area) return null;
  return leavesOf(root, area)[i] || null;
}
function resolveEl(root, key) {
  if (!key.startsWith('^')) return root.querySelector(areaSel(key));
  const p = root.querySelector(areaSel(key.slice(1)))?.parentElement;
  return p && !p.classList.contains('cf-card') ? p : null;
}
function containerKey(p) {
  if (!p || p.classList.contains('cf-card')) return null;
  if (p.dataset.area) return p.dataset.area;
  const kid = [...p.children].find(k => k.dataset && k.dataset.area);
  return kid ? `^${kid.dataset.area}` : null;
}
function setLeafText(el, text) {
  let done = false;
  [...el.childNodes].forEach(n => { if (n.nodeType === 3 && n.nodeValue.trim()) { n.nodeValue = done ? '' : text; done = true; } });
}
function applyTweaks(html, tw) {
  if (!tw || (!tw.el && !tw.text)) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const root = tpl.content;
  for (const [key, e] of Object.entries(tw.el || {})) { const el = resolveEl(root, key); if (el) Object.assign(el.style, mergedCSS(e)); }
  for (const [key, t] of Object.entries(tw.text || {})) {
    const el = resolveText(root, key);
    if (!el) continue;
    if (t.css) Object.assign(el.style, t.css);
    if (t.text != null) setLeafText(el, t.text);
  }
  return tpl.innerHTML;
}

/* ---------- Bearbeiten: Feinschliff wie Auto-Layout ---------- */
const snap = v => Math.round(v / U) * U;
const visibleKids = p => [...p.children].filter(k => !/^(STYLE|SCRIPT)$/.test(k.tagName) && k.getClientRects().length && getComputedStyle(k).position !== 'absolute');
const axisName = { row: 'waagerecht', column: 'senkrecht', grid: 'Raster', flow: 'untereinander' };
const styleFamily = st => st.family || Object.keys(S.families)[0];
const ICON_LOCK = '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

function layoutInfo(el) {
  const p = el.parentElement, cs = getComputedStyle(p), own = getComputedStyle(el);
  if (own.position === 'absolute' || own.position === 'fixed') return { kind: 'free', parent: p, axis: 'flow' };
  if (cs.display.includes('flex')) return { kind: 'flex', axis: cs.flexDirection.startsWith('column') ? 'column' : 'row', parent: p };
  if (cs.display.includes('grid')) {
    const fixed = own.gridColumnStart !== 'auto' || own.gridRowStart !== 'auto';
    return { kind: fixed ? 'grid-fixed' : 'grid', axis: 'grid', parent: p };
  }
  return { kind: 'flow', axis: 'flow', parent: p };
}
function containerName(p) {
  if (p.classList.contains('cf-card')) return 'Karte';
  const cls = p.classList[0] ? `.${p.classList[0]}` : p.tagName.toLowerCase();
  if (p.dataset.area) return `„${p.dataset.area}“`;
  const area = p.closest('[data-area]');
  return area ? `${cls} in „${area.dataset.area}“` : cls;
}

function twLayout(ed, create = true) {
  if (!F.tw[ed.c.id]) { if (!create) return null; F.tw[ed.c.id] = {}; }
  const t = F.tw[ed.c.id];
  if (!t[ed.l.id]) { if (!create) return null; t[ed.l.id] = {}; }
  return t[ed.l.id];
}
const twEl = (ed, key) => { const t = twLayout(ed); t.el ||= {}; return (t.el[key] ||= {}); };
const twText = (ed, key) => { const t = twLayout(ed); t.text ||= {}; return (t.text[key] ||= {}); };
const isEmpty = v => v == null || v === '' || (typeof v === 'object' && !Object.keys(v).length);
function pruneTw(id) {
  const t = F.tw[id];
  if (!t) return;
  for (const [lid, L] of Object.entries(t)) {
    for (const g of ['el', 'text']) for (const e of Object.values(L[g] || {})) for (const [k, v] of Object.entries(e)) if (isEmpty(v)) delete e[k];
    for (const g of ['el', 'text', 'locks', 'notes']) {
      for (const [k, v] of Object.entries(L[g] || {})) if (isEmpty(v)) delete L[g][k];
      if (isEmpty(L[g])) delete L[g];
    }
    if (isEmpty(L)) delete t[lid];
  }
}

const saveTimers = {};
function saveTweaks(id, reason) {
  pruneTw(id);
  if (!F.live) return;
  clearTimeout(saveTimers[id]);
  saveTimers[id] = setTimeout(() => {
    fetch('/api/tweaks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, tweaks: F.tw[id] || {}, reason }) }).catch(() => {});
  }, 150);
}

function setReopen(ed) { try { sessionStorage.setItem('cf.reopen', JSON.stringify({ c: ed.c.id, li: ed.l.index, sel: ed.sel?.name || null, y: scrollY })); } catch {} }
function takeReopen() {
  try { const v = JSON.parse(sessionStorage.getItem('cf.reopen') || 'null'); sessionStorage.removeItem('cf.reopen'); return v; } catch { return null; }
}

function toggleEdit(fig, opts = {}) {
  if (fig.classList.contains('is-editing')) return endEdit(fig);
  main.querySelectorAll('.cf-lay-item.is-editing').forEach(f => endEdit(f));
  const c = F.byId[fig.dataset.c], l = c.layouts[+fig.dataset.li];
  const holder = fig.querySelector('.cf-lay-card');
  const ed = fig._ed = { fig, c, l, holder, card: holder.querySelector('.cf-card'), sel: null };
  ed.rectOf = el => {
    const cb = ed.card.getBoundingClientRect(), r = el.getBoundingClientRect(), k = cb.width / ed.W;
    return { x: r1((r.left - cb.left) / k), y: r1((r.top - cb.top) / k), w: r1(r.width / k), h: r1(r.height / k) };
  };
  collectAreas(ed);
  fig.classList.add('is-editing');
  fig.querySelector('.cf-edit') && (fig.querySelector('.cf-edit').innerHTML = `${icon('check', 14)}Fertig`);
  ed.ov = document.createElement('div');
  ed.ov.className = 'ed-ov';
  holder.appendChild(ed.ov);
  ed.panel = document.createElement('div');
  ed.panel.className = 'ed-panel';
  holder.after(ed.panel);
  ed.onKey = e => { if (e.key === 'Escape' && !e.target.isContentEditable) endEdit(fig); };
  document.addEventListener('keydown', ed.onKey);
  if (opts.sel) ed.sel = ed.areas.find(a => a.name === opts.sel) || null;
  drawOverlay(ed);
  renderPanel(ed);
}

function collectAreas(ed) {
  ed.W = ed.card.offsetWidth;
  ed.H = ed.card.offsetHeight;
  ed.areas = [...ed.card.querySelectorAll('[data-area]')].map((el, i) => {
    const [role] = el.dataset.area.split(':');
    return { i, el, name: el.dataset.area, role: S.areaRoles.includes(role) ? role : 'meta', bleed: el.hasAttribute('data-bleed'), info: layoutInfo(el) };
  });
}

function commit(ed) {
  saveTweaks(ed.c.id);
  const sel = ed.sel?.name;
  ed.card.outerHTML = cardHTML(ed.c, ed.l);
  ed.card = ed.holder.querySelector('.cf-card');
  collectAreas(ed);
  ed.sel = sel ? ed.areas.find(a => a.name === sel) || null : null;
  remeasure(ed);
  drawOverlay(ed);
  renderPanel(ed);
}

function remeasure(ed) {
  const host = document.createElement('div');
  host.id = 'cf-measure';
  document.body.appendChild(host);
  F.bps[`${ed.c.id}/${ed.l.id}`] = measure(ed.c, ed.l, host);
  host.remove();
  consistencyPass();
  renderSummary();
  const sec = document.getElementById(`lay-${ed.c.id}`);
  const head = sec?.querySelector(':scope > .cf-row-head');
  const bps = ed.c.layouts.map(x => bpOf(ed.c, x));
  head?.querySelector(':scope > .cf-badge')?.remove();
  head?.insertAdjacentHTML('beforeend', badgeHTML(bps));
  head?.querySelector(':scope > [data-act="viol"]')?.addEventListener('click', () => sec.classList.toggle('show-viol'));
  const ul = sec?.querySelector(':scope > .cf-viol');
  if (ul) ul.innerHTML = findingsItems(bps, true);
}

function gapRects(ed, p, axis) {
  const kids = visibleKids(p).map(k => ed.rectOf(k)).sort((a, b) => (axis === 'row' ? a.x - b.x : a.y - b.y));
  const pr = ed.rectOf(p), out = [];
  for (let i = 0; i < kids.length - 1; i++) {
    const a = kids[i], b = kids[i + 1];
    if (axis === 'column') { const y = a.y + a.h, g = b.y - y; out.push({ x: pr.x, y: g < 6 ? y - 3 : y, w: pr.w, h: Math.max(6, g) }); }
    else { const x = a.x + a.w, g = b.x - x; out.push({ x: g < 6 ? x - 3 : x, y: pr.y, w: Math.max(6, g), h: pr.h }); }
  }
  return out;
}

function drawOverlay(ed) {
  const bp = bpOf(ed.c, ed.l);
  const tl = twLayout(ed, false) || {};
  const gaps = [], seen = new Set();
  ed.areas.forEach(a => {
    const p = a.info.parent;
    if (a.info.kind !== 'flex' || seen.has(p)) return;
    seen.add(p);
    const key = containerKey(p);
    if (key && !tl.locks?.[key]) gapRects(ed, p, a.info.axis).forEach(g => gaps.push({ p, key, axis: a.info.axis, g }));
  });
  ed.gapList = gaps;
  ed.ov.style.cssText = `width:${ed.W}px;height:${ed.H}px`;
  ed.ov.innerHTML = gridSVG({ w: ed.W, h: ed.H }, { faint: true })
    + gaps.map((x, n) => `<div class="ed-g ed-g-${x.axis}" data-n="${n}" style="${box(x.g)}" title="Abstand ziehen"></div>`).join('')
    + ed.areas.map(a => {
      const b = bp?.areas.find(x => x.name === a.name);
      const locked = !!tl.locks?.[a.name], note = tl.notes?.[a.name];
      const cls = `ed-a role-${a.role}${b && (b.off || b.out) ? ' is-bad' : ''}${ed.sel === a ? ' is-sel' : ''}${locked ? ' is-locked' : ''}`;
      return `<div class="${cls}" data-i="${a.i}" style="${box(ed.rectOf(a.el))}"><span>${locked ? ICON_LOCK : ''}${esc(a.name)}</span>${note ? `<b class="ed-dot" title="${esc(note)}"></b>` : ''}${locked ? '' : ['e', 's', 'se'].map(d => `<i data-d="${d}"></i>`).join('')}</div>`;
    }).join('')
    + '<div class="ed-ins" hidden></div>'
    + `<div class="ed-h" title="Kartenhöhe ziehen"><span>${ed.H} px</span></div>`;
  ed.ov.querySelectorAll('.ed-a, .ed-g, .ed-h').forEach(el => el.addEventListener('pointerdown', e => startDrag(ed, e)));
  ed.ov.querySelectorAll('.ed-a').forEach(el => el.addEventListener('dblclick', e => {
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find(x => ed.card.contains(x) && isLeaf(x));
    startTextEdit(ed, hit);
  }));
}

const toCard = (ed, ev) => { const cb = ed.card.getBoundingClientRect(), k = cb.width / ed.W; return { x: (ev.clientX - cb.left) / k, y: (ev.clientY - cb.top) / k }; };
function nearest(ed, els, pt) {
  let best = null;
  els.forEach(el => { const r = ed.rectOf(el), d = Math.hypot(pt.x - (r.x + r.w / 2), pt.y - (r.y + r.h / 2)); if (!best || d < best.d) best = { el, r, d }; });
  return best;
}

// Umsortieren per CSS-order (Flex/Grid, nur wenn alle Geschwister Flächen sind) oder Plätze tauschen (Grid mit festen Plätzen)
function reorderPlan(ed, a) {
  const { kind, parent: p, axis } = a.info;
  if (kind === 'grid-fixed') {
    const others = visibleKids(p).filter(x => x !== a.el && x.dataset.area);
    if (!others.length) return null;
    return {
      find(ev, ins) {
        const best = nearest(ed, others, toCard(ed, ev));
        ed.ov.querySelectorAll('.is-target').forEach(x => x.classList.remove('is-target'));
        const ta = ed.areas.find(x => x.el === best?.el);
        if (ta) ed.ov.querySelector(`.ed-a[data-i="${ta.i}"]`)?.classList.add('is-target');
        ins.hidden = true;
        return best && { el: best.el };
      },
      apply(d) {
        const A = getComputedStyle(a.el), B = getComputedStyle(d.el);
        twEl(ed, a.name).cssG = { gridRow: B.gridRow, gridColumn: B.gridColumn };
        twEl(ed, d.el.dataset.area).cssG = { gridRow: A.gridRow, gridColumn: A.gridColumn };
      },
    };
  }
  if (kind !== 'flex' && kind !== 'grid') return null;
  const kids = visibleKids(p);
  if (!kids.every(x => x.dataset.area)) return null;
  const pos = el => ed.rectOf(el);
  const seq = kids.slice().sort((x, y) => { const r = pos(x), s = pos(y); return axis === 'row' ? r.x - s.x : axis === 'column' ? r.y - s.y : (Math.abs(r.y - s.y) > 1 ? r.y - s.y : r.x - s.x); });
  const others = seq.filter(x => x !== a.el);
  return {
    find(ev, ins) {
      const pt = toCard(ed, ev), best = nearest(ed, others, pt);
      if (!best) return null;
      const r = best.r, sameRow = Math.abs(pt.y - (r.y + r.h / 2)) < r.h / 2;
      const after = axis === 'row' ? pt.x > r.x + r.w / 2 : axis === 'column' ? pt.y > r.y + r.h / 2 : (sameRow ? pt.x > r.x + r.w / 2 : pt.y > r.y + r.h / 2);
      const vertical = axis === 'row' || (axis === 'grid' && sameRow);
      ins.hidden = false;
      ins.style.cssText = vertical
        ? `left:${(after ? r.x + r.w : r.x) - 1}px;top:${r.y}px;width:2px;height:${r.h}px`
        : `left:${r.x}px;top:${(after ? r.y + r.h : r.y) - 1}px;width:${r.w}px;height:2px`;
      return { el: best.el, after };
    },
    apply(d) {
      const list = others.slice();
      list.splice(list.indexOf(d.el) + (d.after ? 1 : 0), 0, a.el);
      const domOrder = list.every((x, i) => x === kids[i]);
      list.forEach((x, i) => { const e = twEl(ed, x.dataset.area); if (domOrder) delete e.cssO; else e.cssO = { order: String(i) }; });
    },
  };
}

function startDrag(ed, e) {
  if (e.button !== 0) return;
  const target = e.currentTarget, resize = e.target.closest('i[data-d]');
  e.preventDefault();
  e.stopPropagation();
  const k = ed.card.getBoundingClientRect().width / ed.W;
  const sx = e.clientX, sy = e.clientY;
  target.setPointerCapture(e.pointerId);
  target.classList.add('is-active');
  const tl = twLayout(ed, false) || {};
  let onMove, onUp;

  if (target.classList.contains('ed-h')) {
    const H0 = ed.H;
    let H = H0;
    onMove = ev => { H = Math.max(64, snap(H0 + (ev.clientY - sy) / k)); ed.card.style.height = `${H}px`; ed.ov.style.height = `${H}px`; target.querySelector('span').textContent = `${H} px`; };
    onUp = () => { if (H === H0) return 'noop'; const t = twLayout(ed); if (H === ed.l.height) delete t.height; else t.height = H; };
  } else if (target.classList.contains('ed-g')) {
    const x = ed.gapList[+target.dataset.n];
    const start = parseFloat(getComputedStyle(x.p)[x.axis === 'row' ? 'columnGap' : 'rowGap']) || 0;
    let g = start;
    onMove = ev => { g = Math.min(64, Math.max(0, snap(start + (x.axis === 'row' ? ev.clientX - sx : ev.clientY - sy) / k))); x.p.style.gap = `${g}px`; target.title = `Abstand ${g} px`; };
    onUp = () => { if (g === start) return 'noop'; const e2 = twEl(ed, x.key); e2.cssL = { ...(e2.cssL || {}), gap: `${g}px` }; };
  } else {
    const a = ed.areas[+target.dataset.i];
    const locked = !!tl.locks?.[a.name];
    if (resize && !locked) {
      const dir = resize.dataset.d, start = ed.rectOf(a.el), I = a.bleed ? 0 : S.inset;
      let w = null, h = null;
      onMove = ev => {
        const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
        if (dir.includes('e')) { w = Math.min(Math.max(U, snap(start.w + dx)), ed.W - I - start.x); Object.assign(a.el.style, sizeCSS(a.el, 'w', 'fixed', w)); }
        if (dir.includes('s')) { h = Math.max(U, snap(start.h + dy)); Object.assign(a.el.style, sizeCSS(a.el, 'h', 'fixed', h)); }
        const r = ed.rectOf(a.el);
        target.style.cssText = box(r);
        target.querySelector('span').textContent = `${a.name} · ${Math.round(r.w)} × ${Math.round(r.h)}`;
      };
      onUp = () => {
        if (w == null && h == null) return 'noop';
        if (w != null) setSize(ed, a, 'w', 'fixed', w, false);
        if (h != null) setSize(ed, a, 'h', 'fixed', h, false);
      };
    } else {
      const plan = locked ? null : reorderPlan(ed, a);
      const ins = ed.ov.querySelector('.ed-ins');
      let started = false, drop = null, blocked = false;
      onMove = ev => {
        const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
        if (!started) {
          if (Math.hypot(dx, dy) < 4) return;
          if (!plan) { blocked = true; return; }
          started = true;
          target.classList.add('is-drag');
        }
        target.style.translate = `${dx}px ${dy}px`;
        drop = plan.find(ev, ins);
      };
      onUp = () => {
        ins.hidden = true;
        if (!started) {
          if (blocked) ed.flash = locked ? 'Diese Fläche ist gesperrt.' : 'Umsortieren geht hier nicht direkt: In dieser Reihe stehen Elemente ohne Fläche. Schreib es Claude als Notiz.';
          ed.sel = a;
          drawOverlay(ed);
          renderPanel(ed);
          return 'noop';
        }
        if (!drop) return 'noop';
        plan.apply(drop);
      };
    }
  }

  const up = () => {
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
    target.classList.remove('is-active');
    if (onUp?.() === 'noop') { if (!target.isConnected || !target.classList.contains('ed-a')) drawOverlay(ed); return; }
    commit(ed);
  };
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
}

// Hug / Fill / Fest als CSS – abhängig davon, ob die Achse Haupt- oder Querachse des Elternteils ist
function sizeCSS(el, axis, mode, px) {
  const pcs = getComputedStyle(el.parentElement);
  const dim = axis === 'w' ? 'width' : 'height', minDim = axis === 'w' ? 'minWidth' : 'minHeight', maxDim = axis === 'w' ? 'maxWidth' : 'maxHeight';
  const flex = pcs.display.includes('flex'), grid = pcs.display.includes('grid');
  const main = flex && ((axis === 'w') === !pcs.flexDirection.startsWith('column'));
  const self = axis === 'w' ? 'justifySelf' : 'alignSelf';
  const hug = axis === 'w' ? 'fit-content' : 'auto';
  if (mode === 'fixed') return main ? { [dim]: `${px}px`, flexGrow: '0', flexShrink: '0', flexBasis: 'auto', [minDim]: '0', [maxDim]: 'none' } : { [dim]: `${px}px`, [minDim]: '0', [maxDim]: 'none' };
  if (mode === 'fill') {
    if (main) return { flexGrow: '1', flexShrink: '1', flexBasis: '0%', [dim]: 'auto', [minDim]: '0' };
    if (flex) return { alignSelf: 'stretch', [dim]: 'auto' };
    if (grid) return { [self]: 'stretch', [dim]: 'auto' };
    return axis === 'w' ? { width: 'auto' } : { height: '100%' };
  }
  if (main) return { flexGrow: '0', flexShrink: '0', flexBasis: 'auto', [dim]: hug };
  if (flex) return { alignSelf: 'flex-start', [dim]: hug };
  if (grid) return { [self]: 'start', [dim]: hug };
  return { [dim]: hug };
}
function setSize(ed, a, axis, mode, px, doCommit = true) {
  const e = twEl(ed, a.name), slot = axis === 'w' ? 'cssW' : 'cssH';
  if (mode === 'auto') { delete e[slot]; if (e.mode) delete e.mode[axis]; }
  else {
    const r = ed.rectOf(a.el), v = snap(px ?? (axis === 'w' ? r.w : r.h));
    e[slot] = sizeCSS(a.el, axis, mode, v);
    e.mode = { ...(e.mode || {}), [axis]: mode === 'fixed' ? v : mode };
  }
  if (doCommit) commit(ed);
}
function detectSize(ed, a, axis) {
  const m = twLayout(ed, false)?.el?.[a.name]?.mode?.[axis];
  if (m != null) return m;
  const el = a.el, p = el.parentElement, pcs = getComputedStyle(p), cs = getComputedStyle(el);
  const flex = pcs.display.includes('flex'), main = flex && ((axis === 'w') === !pcs.flexDirection.startsWith('column'));
  const r = ed.rectOf(el), size = axis === 'w' ? r.w : r.h;
  if (main && parseFloat(cs.flexGrow) > 0) return 'fill';
  const pr = ed.rectOf(p);
  const pad = axis === 'w' ? parseFloat(pcs.paddingLeft) + parseFloat(pcs.paddingRight) : parseFloat(pcs.paddingTop) + parseFloat(pcs.paddingBottom);
  if (!main && Math.abs(size - ((axis === 'w' ? pr.w : pr.h) - pad)) < 1) return 'fill';
  const dim = axis === 'w' ? 'width' : 'height', old = el.style[dim], oldF = el.style.flex;
  el.style[dim] = axis === 'w' ? 'max-content' : 'auto';
  if (main) el.style.flex = 'none';
  const nat = ed.rectOf(el)[axis];
  el.style[dim] = old;
  el.style.flex = oldF;
  return Math.abs(nat - size) < 1 ? 'hug' : Math.round(size);
}

function layoutOf(el) {
  const cs = getComputedStyle(el);
  const norm = (v, d) => ({ normal: d, start: 'flex-start', end: 'flex-end', left: 'flex-start', right: 'flex-end' }[v] || v);
  return {
    flex: cs.display.includes('flex'), grid: cs.display.includes('grid'),
    dir: cs.flexDirection.startsWith('column') ? 'column' : 'row',
    justify: norm(cs.justifyContent, 'flex-start'), align: norm(cs.alignItems, 'stretch'),
    gap: parseFloat(cs.display.includes('flex') && !cs.flexDirection.startsWith('column') ? cs.columnGap : cs.rowGap) || 0,
    pad: Math.max(...['Top', 'Right', 'Bottom', 'Left'].map(s => parseFloat(cs[`padding${s}`]) || 0)),
  };
}
function setLayout(ed, a, patch) {
  const e = twEl(ed, a.name);
  e.cssL = { ...(e.cssL || {}), ...patch };
  for (const [k, v] of Object.entries(e.cssL)) if (v == null) delete e.cssL[k];
  commit(ed);
}

// Textstile mit Schriftzähler: eine Option ist gesperrt, wenn sie eine Grenze aus system.js reißen würde
function typeSets(ed, except) {
  const fams = new Set(), sizes = new Set(), weights = new Set();
  const els = [...ed.card.querySelectorAll('*')].filter(isLeaf).concat([...ed.card.querySelectorAll('svg text')]);
  for (const el of els) {
    if (el === except) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0 || !el.getClientRects().length) continue;
    let scale = 1;
    if (el instanceof SVGElement) { const m = el.getScreenCTM(); scale = m ? Math.hypot(m.a, m.b) : 1; }
    fams.add(normFamily(cs.fontFamily)); sizes.add(r1(parseFloat(cs.fontSize) * scale)); weights.add(parseInt(cs.fontWeight, 10) || 400);
  }
  return { fams, sizes, weights };
}
function styleBlocked(ed, leaf, st) {
  const { fams, sizes, weights } = typeSets(ed, leaf);
  fams.add(styleFamily(st)); sizes.add(st.size); weights.add(st.weight);
  const L = S.limits;
  if (sizes.size > L.sizes) return `wäre die ${sizes.size}. Größe`;
  if (weights.size > L.weights) return `wäre der ${weights.size}. Schnitt`;
  if (fams.size > L.families) return `wäre die ${fams.size}. Familie`;
  return null;
}
function leafStyle(leaf) {
  const cs = getComputedStyle(leaf);
  const s = { family: normFamily(cs.fontFamily), size: r1(parseFloat(cs.fontSize)), weight: parseInt(cs.fontWeight, 10) || 400, lh: cs.lineHeight === 'normal' ? null : r1(parseFloat(cs.lineHeight)) };
  s.match = S.textStyles.find(t => styleFamily(t) === s.family && t.size === s.size && t.weight === s.weight && t.lh === s.lh) || null;
  return s;
}
function setTextStyle(ed, leaf, id) {
  const key = textKeyOf(ed.card, leaf);
  if (!key) return;
  const t = twText(ed, key);
  if (!id) { delete t.style; delete t.css; }
  else {
    const st = S.textStyles.find(x => x.id === id);
    t.style = id;
    t.css = { fontFamily: famCSS(styleFamily(st)), fontSize: `${st.size}px`, lineHeight: `${st.lh}px`, fontWeight: String(st.weight), fontStyle: 'normal' };
  }
  commit(ed);
}

function startTextEdit(ed, leaf) {
  if (!leaf) return;
  if (leaf.childElementCount) { ed.flash = 'Dieser Text enthält weitere Elemente. Schreib die Änderung Claude als Notiz.'; renderPanel(ed); return; }
  const key = textKeyOf(ed.card, leaf);
  if (!key) return;
  const old = leaf.textContent;
  ed.ov.classList.add('is-texting');
  leaf.contentEditable = 'plaintext-only';
  leaf.classList.add('ed-editing');
  leaf.focus();
  const rg = document.createRange();
  rg.selectNodeContents(leaf);
  getSelection().removeAllRanges();
  getSelection().addRange(rg);
  let done = false;
  const finish = save => {
    if (done) return;
    done = true;
    leaf.removeEventListener('keydown', onKey);
    leaf.removeEventListener('blur', onBlur);
    leaf.removeAttribute('contenteditable');
    leaf.classList.remove('ed-editing');
    ed.ov.classList.remove('is-texting');
    const neu = leaf.textContent.replace(/\s+/g, ' ').trim();
    if (!save || !neu || neu === old.trim()) { leaf.textContent = old; return; }
    saveText(ed, key, old.trim(), neu);
  };
  const onKey = e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
  };
  const onBlur = () => finish(true);
  leaf.addEventListener('keydown', onKey);
  leaf.addEventListener('blur', onBlur);
}
async function saveText(ed, key, from, to) {
  let reason = null;
  if (F.live) {
    try {
      const r = await fetch('/api/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ed.c.id, from, to }) });
      const j = await r.json();
      reason = j.reason;
      if (j.ok) {
        setReopen(ed);
        ed.flash = 'Text in der Datei geändert – gilt für alle Layouts. Die Seite lädt neu …';
        renderPanel(ed);
        return;
      }
    } catch {}
  }
  twText(ed, key).text = to;
  const why = { mehrdeutig: 'steht mehrfach in der Datei', 'nicht gefunden': 'wird berechnet oder steht nicht wörtlich in der Datei', zeichen: 'enthält Zeichen, die nicht direkt in den Code dürfen' }[reason] || 'ließ sich nicht eindeutig zuordnen';
  ed.flash = F.live ? `Als Feinschliff gespeichert, gilt nur für dieses Layout: Der Text ${why}.` : 'Ohne Server gilt die Textänderung nur bis zum Neuladen.';
  commit(ed);
}

function toggleLock(ed, a) {
  const t = twLayout(ed);
  t.locks ||= {};
  if (t.locks[a.name]) delete t.locks[a.name];
  else { const b = bpOf(ed.c, ed.l)?.areas.find(x => x.name === a.name) || ed.rectOf(a.el); t.locks[a.name] = { x: b.x, y: b.y, w: b.w, h: b.h }; }
  commit(ed);
}

function tweakItems(ed, tl) {
  const items = [];
  const fmtMode = m => (m === 'fill' ? 'Füllen' : m === 'hug' ? 'Inhalt (Hug)' : `fest ${m} px`);
  const L_NAMES = { flexDirection: 'Richtung', justifyContent: 'Verteilung', alignItems: 'Quer', gap: 'Abstand', padding: 'Innenabstand', display: 'Auto-Layout' };
  for (const [key, e] of Object.entries(tl.el || {})) {
    const name = key.startsWith('^') ? `Container um „${key.slice(1)}“` : `„${key}“`;
    const d = [];
    if (e.mode?.w != null) d.push(`Breite ${fmtMode(e.mode.w)}`);
    if (e.mode?.h != null) d.push(`Höhe ${fmtMode(e.mode.h)}`);
    if (e.cssL) d.push(Object.entries(e.cssL).map(([k, v]) => `${L_NAMES[k] || k} ${v}`).join(', '));
    if (e.cssO) d.push(`Position ${+e.cssO.order + 1}`);
    if (e.cssG) d.push(`Rasterplatz ${e.cssG.gridRow} / ${e.cssG.gridColumn}`);
    if (d.length) items.push({ kind: 'el', rm: `el|${key}`, label: name, desc: d.join(' · ') });
  }
  for (const [key, t] of Object.entries(tl.text || {})) {
    const j = key.lastIndexOf('>'), area = key.slice(0, j) || 'ohne Fläche', i = +key.slice(j + 1);
    const d = [];
    if (t.style) d.push(`Stil ${S.textStyles.find(s => s.id === t.style)?.name || t.style}`);
    if (t.text != null) d.push(`Text „${t.text}“`);
    if (d.length) items.push({ kind: 'text', rm: `text|${key}`, label: `Text ${i + 1} in „${area}“`, desc: d.join(' · ') });
  }
  if (tl.height) items.push({ kind: 'height', rm: 'height', label: 'Kartenhöhe', desc: `${ed.l.height} → ${tl.height} px` });
  for (const n of Object.keys(tl.locks || {})) items.push({ kind: 'lock', rm: `lock|${n}`, label: `„${n}“`, desc: 'gesperrt' });
  for (const [n, t] of Object.entries(tl.notes || {})) items.push({ kind: 'note', rm: `note|${n}`, label: `Notiz zu „${n}“`, desc: t });
  return items;
}

function bakePrompt(ed) {
  const tl = twLayout(ed, false) || {};
  const items = tweakItems(ed, tl);
  const tweaks = items.filter(i => i.kind === 'el' || i.kind === 'text' || i.kind === 'height');
  const notes = items.filter(i => i.kind === 'note');
  const locks = Object.keys(tl.locks || {});
  return `Feinschliff einarbeiten: Komponente „${ed.c.name}“ (components/${ed.c.id}.js), Layout „${ed.l.name}“ (id ${ed.l.id}).
${tweaks.length ? `In components/${ed.c.id}.tweaks.js stehen direkte Anpassungen aus dem Bearbeiten-Modus. Übernimm sie sauber in components/${ed.c.id}.js – als CSS in \`css\`, Reihenfolge im Markup oder in \`data\`, \`height\` am Layout, Texte in \`data\` –, nicht als Inline-Stile:
${tweaks.map(i => `- ${i.label}: ${i.desc}`).join('\n')}
` : ''}${notes.length ? `Notizen (Aufträge):
${notes.map(i => `- ${i.label.replace('Notiz zu ', '')}: ${i.desc}`).join('\n')}
` : ''}${locks.length ? `Gesperrt, nicht verändern: ${locks.map(n => `„${n}“`).join(', ')}.
` : ''}Danach in components/${ed.c.id}.tweaks.js für das Layout „${ed.l.id}“ alles außer "locks" und "exceptions" entfernen (andere Layouts unverändert lassen). Prüfe mit node tools/check.mjs ${ed.c.id}. Das Ergebnis soll so aussehen wie vorher mit Feinschliff, plus die Notizen.`;
}

function askPrompt(ed, wish) {
  const tl = twLayout(ed, false) || {};
  const items = tweakItems(ed, tl);
  const tweaks = items.filter(i => i.kind === "el" || i.kind === "text" || i.kind === "height");
  const notes = items.filter(i => i.kind === "note");
  const locks = Object.keys(tl.locks || {});
  return `Änderungswunsch aus dem Bearbeiten-Modus: Komponente „${ed.c.name}“ (components/${ed.c.id}.js), Layout „${ed.l.name}“ (id ${ed.l.id})${ed.sel ? `, ausgewählte Fläche „${ed.sel.name}“` : ""}.
Wunsch: ${wish}
${tweaks.length ? `Aktueller Feinschliff aus components/${ed.c.id}.tweaks.js (arbeite ihn mit ein und entferne ihn dort danach für dieses Layout, locks und exceptions bleiben):
${tweaks.map(i => `- ${i.label}: ${i.desc}`).join("\n")}
` : ""}${notes.length ? `Offene Notizen, gleich mit erledigen:
${notes.map(i => `- ${i.label.replace("Notiz zu ", "")}: ${i.desc}`).join("\n")}
` : ""}${locks.length ? `Gesperrt, nicht verändern: ${locks.map(n => `„${n}“`).join(", ")}.
` : ""}Nur dieses Layout ändern, außer der Wunsch meint ausdrücklich alle. Prüfe mit node tools/check.mjs ${ed.c.id}.`;
}

function seg(name, value, options, disabled) {
  return `<div class="ed-seg" role="group">${options.map(([v, label, title]) => `<button type="button" data-seg="${name}" data-v="${esc(v)}"${String(v) === String(value) ? ' class="on"' : ''}${disabled ? ' disabled' : ''}${title ? ` title="${esc(title)}"` : ''}>${label}</button>`).join('')}</div>`;
}

function renderPanel(ed) {
  const a = ed.sel, tl = twLayout(ed, false) || {}, bp = bpOf(ed.c, ed.l);
  const locked = a ? !!tl.locks?.[a.name] : false;
  const out = [];
  out.push(`<div class="ed-status">${bp.ok ? `<span class="cf-badge ok">${icon('check', 14)}Im Raster</span>` : `<span class="cf-badge bad">${bp.violations.length} ${bp.violations.length === 1 ? 'Verstoß' : 'Verstöße'}</span>`}<span class="ed-save">${F.live ? `speichert in <code>components/${esc(ed.c.id)}.tweaks.js</code>` : 'ohne Server: gilt bis zum Neuladen'}</span></div>`);
  if (!bp.ok || bp.warnings?.length || bp.accepted?.length) out.push(`<ul class="ed-viol cf-viol-inline">${findingsItems([bp])}</ul>`);
  if (ed.flash) { out.push(`<p class="ed-flash">${esc(ed.flash)}</p>`); ed.flash = null; }

  if (!a) {
    out.push(`<p class="ed-hint">Fläche anklicken, um sie einzustellen. Ziehen sortiert um, die Griffe rechts und unten setzen eine feste Größe, pinke Balken ändern den Abstand, Doppelklick bearbeitet Text, der Griff unten die Kartenhöhe. Alles rastet auf ${U} px ein.</p>`);
  } else {
    const info = a.info, pName = containerName(info.parent);
    out.push(`<div class="ed-selhead"><i class="ed-swatch role-${a.role}"></i><b>${esc(a.name)}</b>
      ${a.el.parentElement.closest('[data-area]') && ed.card.contains(a.el.parentElement.closest('[data-area]')) ? `<button type="button" class="ed-mini" data-a="parent" title="übergeordnete Fläche wählen">↑ Container</button>` : ''}
      <button type="button" class="ed-mini${locked ? ' on' : ''}" data-a="lock">${ICON_LOCK}${locked ? 'Gesperrt' : 'Sperren'}</button>
      <button type="button" class="ed-mini" data-a="deselect" aria-label="Auswahl aufheben">${icon('close', 14)}</button></div>`);
    if (locked) out.push('<p class="ed-hint">Gesperrt: Claude und der Feinschliff lassen Lage und Größe dieser Fläche in Ruhe (R9 wird gemessen).</p>');

    // Größe
    const sizeRow = axis => {
      const m = detectSize(ed, a, axis), mode = typeof m === 'number' ? 'fixed' : m;
      const r = ed.rectOf(a.el), val = Math.round(axis === 'w' ? r.w : r.h);
      const fillOk = !(axis === 'h' && info.kind === 'flow');
      const tweaked = twLayout(ed, false)?.el?.[a.name]?.mode?.[axis] != null;
      return `<div class="ed-row"><span class="ed-lab">${axis === 'w' ? 'Breite' : 'Höhe'}</span>
        ${seg(`size-${axis}`, mode, [['hug', 'Hug', 'so groß wie der Inhalt'], ...(fillOk ? [['fill', 'Füllen', 'nimmt den freien Platz']] : []), ['fixed', 'Fest', 'feste Größe im Raster']], locked)}
        <span class="ed-num${mode === 'fixed' ? '' : ' is-muted'}"><button type="button" data-step="${axis}" data-d="-1"${locked ? ' disabled' : ''} aria-label="${U} px weniger">−</button><b>${val}</b><button type="button" data-step="${axis}" data-d="1"${locked ? ' disabled' : ''} aria-label="${U} px mehr">+</button></span>
        ${tweaked ? `<button type="button" class="ed-reset" data-reset-size="${axis}" title="wie generiert">${icon('refresh', 12)}</button>` : ''}</div>`;
    };
    out.push(`<div class="ed-sec"><h4>Größe <em>in ${esc(pName)}${info.kind === 'free' ? ', frei' : `, ${axisName[info.axis]}`}</em></h4>${sizeRow('w')}${sizeRow('h')}</div>`);

    // Auto-Layout der Fläche selbst
    const lay = layoutOf(a.el);
    const hasKids = visibleKids(a.el).length > 0 && !a.el.matches('[data-media]');
    const cssL = twLayout(ed, false)?.el?.[a.name]?.cssL;
    if (lay.flex || lay.grid) {
      const gaps = [0, 8, 16, 24, 32, 40, 48].map(n => [n, String(n)]);
      out.push(`<div class="ed-sec"><h4>Auto-Layout <em>${lay.flex ? (lay.dir === 'row' ? 'waagerecht' : 'senkrecht') : 'Raster'}</em>${cssL ? `<button type="button" class="ed-reset" data-a="reset-layout" title="wie generiert">${icon('refresh', 12)}</button>` : ''}</h4>
        ${lay.flex ? `<div class="ed-row"><span class="ed-lab">Richtung</span>${seg('dir', lay.dir, [['row', '→ waagerecht'], ['column', '↓ senkrecht']], locked)}</div>
        <div class="ed-row"><span class="ed-lab">Verteilung</span>${seg('justify', lay.justify, [['flex-start', 'Start'], ['center', 'Mitte'], ['flex-end', 'Ende'], ['space-between', 'Verteilt']], locked)}</div>
        <div class="ed-row"><span class="ed-lab">Quer</span>${seg('align', lay.align, [['flex-start', 'Start'], ['center', 'Mitte'], ['flex-end', 'Ende'], ['stretch', 'Strecken']], locked)}</div>` : ''}
        <div class="ed-row"><span class="ed-lab">Abstand</span>${seg('gap', lay.gap, gaps, locked)}</div>
        <div class="ed-row"><span class="ed-lab">Innen</span>${seg('pad', lay.pad, [[0, '0'], [8, '8'], [16, '16'], [24, '24']], locked)}</div></div>`);
    } else if (hasKids) {
      out.push(`<div class="ed-sec"><h4>Auto-Layout</h4><button type="button" class="cf-btn" data-a="add-layout"${locked ? ' disabled' : ''}>${icon('plus', 14)}Auto-Layout hinzufügen</button></div>`);
    }

    // Texte
    const leaves = leavesOf(ed.card, a.el);
    const t = bp.type, L = S.limits;
    const counter = `<em class="${t.sizes.length > L.sizes || t.weights.length > L.weights ? 'is-bad' : ''}">${t.sizes.length}/${L.sizes} Größen · ${t.weights.length}/${L.weights} Schnitte · ${t.families.length}/${L.families} Familien</em>`;
    if (leaves.length) {
      out.push(`<div class="ed-sec"><h4>Texte ${counter}</h4>${leaves.map((leaf, i) => {
        const st = leafStyle(leaf), key = textKeyOf(ed.card, leaf), tw = tl.text?.[key];
        const cur = tw?.style || '';
        const opts = [`<option value="">${tw?.style ? 'wie generiert' : `wie generiert${st.match ? ` · ${esc(st.match.name)}` : ''}`} (${st.size}/${st.lh ?? '–'} · ${st.weight})</option>`]
          .concat(S.textStyles.map(s => {
            const why = cur === s.id ? null : styleBlocked(ed, leaf, s);
            return `<option value="${s.id}"${cur === s.id ? ' selected' : ''}${why ? ' disabled' : ''}>${esc(s.name)} · ${s.size}/${s.lh} · ${s.weight}${s.family ? ' · Baskerville' : ''}${why ? ` – ${why}` : ''}</option>`;
          }));
        return `<div class="ed-text"><span class="ed-tx clip" title="${esc(leaf.textContent.trim())}">${esc(leaf.textContent.trim())}</span>
          <select id="ed-st-${esc(ed.c.id)}-${esc(ed.l.id)}-${i}" data-leaf="${i}" aria-label="Textstil"${locked ? ' disabled' : ''}>${opts.join('')}</select>
          <button type="button" class="ed-mini" data-edit-leaf="${i}" aria-label="Text bearbeiten">${icon('edit', 14)}</button></div>`;
      }).join('')}</div>`);
    } else {
      out.push(`<div class="ed-sec"><h4>Texte ${counter}</h4><p class="ed-hint">Die Texte liegen in den inneren Flächen. Wähl eine davon aus.</p></div>`);
    }

    // Notiz
    out.push(`<div class="ed-sec"><h4>Notiz für Claude</h4><textarea id="ed-note-${esc(ed.c.id)}-${esc(ed.l.id)}-${a.i}" rows="2" placeholder="z. B. „mehr Luft nach unten“ oder „erst die Uhrzeit, dann der Titel“">${esc(tl.notes?.[a.name] || '')}</textarea></div>`);
  }

  // Direkt an Claude
  out.push(`<form class="ed-sec ed-ask" autocomplete="off"><h4>Claude fragen <em>${a ? `zu „${esc(a.name)}“` : "zu diesem Layout"}</em></h4>
    <div class="ed-askrow"><input id="ed-ask-${esc(ed.c.id)}-${esc(ed.l.id)}" placeholder="${a ? "z. B. „mehr Luft nach unten“" : "z. B. „Titel größer, Liste ruhiger“"}" aria-label="Änderungswunsch an Claude"><button type="submit" class="cf-btn is-primary">${F.live ? "Senden" : "Anweisung"}</button></div>
    <div class="b-log ed-log ed-asklog"></div></form>`);

  // Übersicht
  const items = tweakItems(ed, tl);
  const bakeable = items.some(i => i.kind !== 'lock');
  out.push(`<div class="ed-sec ed-sum"><h4>Feinschliff in diesem Layout <em>${items.length ? items.length : 'noch nichts'}</em></h4>
    ${items.length ? `<ul class="ed-list">${items.map(i => `<li><div><code>${esc(i.label)}</code><span>${esc(i.desc)}</span></div><button type="button" class="ed-mini" data-rm="${esc(i.rm)}" aria-label="Entfernen">${icon('close', 12)}</button></li>`).join('')}</ul>` : ''}
    <div class="ed-actions">
      <button type="button" class="cf-btn" data-a="reset-all"${items.some(i => i.kind === 'el' || i.kind === 'text' || i.kind === 'height') ? '' : ' disabled'}>Feinschliff zurücksetzen</button>
      <button type="button" class="cf-btn is-primary" data-a="bake"${bakeable ? '' : ' disabled'}>${F.live ? 'In den Code einarbeiten' : 'Anweisung für Claude'}</button>
    </div>
    <div class="b-log ed-log"></div></div>`);
  ed.panel.innerHTML = out.join('');
  bindPanel(ed);
}

function bindPanel(ed) {
  const P = ed.panel, a = ed.sel;
  const on = (sel, fn, ev = 'click') => P.querySelectorAll(sel).forEach(el => el.addEventListener(ev, e => fn(el, e)));
  on('[data-a="deselect"]', () => { ed.sel = null; drawOverlay(ed); renderPanel(ed); });
  on('[data-a="lock"]', () => toggleLock(ed, a));
  on('[data-a="parent"]', () => { const p = a.el.parentElement.closest('[data-area]'); ed.sel = ed.areas.find(x => x.el === p) || null; drawOverlay(ed); renderPanel(ed); });
  on('[data-seg]', b => {
    const k = b.dataset.seg, v = b.dataset.v;
    if (k === 'size-w' || k === 'size-h') return setSize(ed, a, k.slice(-1), v);
    if (k === 'dir') return setLayout(ed, a, { flexDirection: v });
    if (k === 'justify') return setLayout(ed, a, { justifyContent: v });
    if (k === 'align') return setLayout(ed, a, { alignItems: v });
    if (k === 'gap') return setLayout(ed, a, { gap: `${v}px` });
    if (k === 'pad') return setLayout(ed, a, { padding: `${v}px` });
  });
  on('[data-step]', b => {
    const axis = b.dataset.step, r = ed.rectOf(a.el);
    setSize(ed, a, axis, 'fixed', Math.max(U, snap((axis === 'w' ? r.w : r.h) + (+b.dataset.d) * U)));
  });
  on('[data-reset-size]', b => setSize(ed, a, b.dataset.resetSize, 'auto'));
  on('[data-a="reset-layout"]', () => { const e = twEl(ed, a.name); delete e.cssL; commit(ed); });
  on('[data-a="add-layout"]', () => setLayout(ed, a, { display: 'flex', flexDirection: 'column', gap: '0px' }));
  on('select[data-leaf]', s => setTextStyle(ed, leavesOf(ed.card, a.el)[+s.dataset.leaf], s.value), 'change');
  on('[data-edit-leaf]', b => startTextEdit(ed, leavesOf(ed.card, a.el)[+b.dataset.editLeaf]));
  on('textarea', (ta) => {
    const t = twLayout(ed);
    t.notes ||= {};
    t.notes[a.name] = ta.value.trim();
    saveTweaks(ed.c.id);
  }, 'input');
  on('textarea', () => { drawOverlay(ed); renderPanelKeepFocus(ed); }, 'change');
  on('[data-rm]', b => {
    const [kind, key] = b.dataset.rm.split('|');
    const t = twLayout(ed);
    if (kind === 'el') delete t.el?.[key];
    else if (kind === 'text') delete t.text?.[key];
    else if (kind === 'height') delete t.height;
    else if (kind === 'lock') delete t.locks?.[key];
    else if (kind === 'note') delete t.notes?.[key];
    commit(ed);
  });
  on('[data-a="reset-all"]', () => { const t = twLayout(ed); delete t.el; delete t.text; delete t.height; commit(ed); });
  on(".ed-ask", (form, e) => {
    e.preventDefault();
    const input = form.querySelector("input"), wish = input.value.trim();
    if (!wish) return input.focus();
    const prompt = askPrompt(ed, wish), log = form.querySelector(".ed-asklog");
    if (!F.live) return copyHint(log, "Anweisung für Claude Code", prompt);
    P.querySelectorAll("button, select, textarea, input").forEach(x => { x.disabled = true; });
    ed.ov.classList.add("is-locked");
    generate(prompt, { log, view: "layouts" });
  }, "submit");
  on('[data-a="bake"]', () => {
    const prompt = bakePrompt(ed), log = P.querySelector('.ed-log');
    if (!F.live) return copyHint(log, 'Anweisung für Claude Code', prompt);
    P.querySelectorAll('button, select, textarea').forEach(x => { x.disabled = true; });
    ed.ov.classList.add('is-locked');
    generate(prompt, { log, view: 'layouts' });
  });
}
function renderPanelKeepFocus(ed) {
  const id = document.activeElement?.id, y = scrollY;
  renderPanel(ed);
  if (id) document.getElementById(id)?.focus();
  scrollTo(0, y);
}

function endEdit(fig) {
  const ed = fig._ed;
  if (!ed) return;
  document.removeEventListener('keydown', ed.onKey);
  ed.ov.remove();
  ed.panel.remove();
  fig.classList.remove('is-editing');
  fig.querySelector('.cf-edit') && (fig.querySelector('.cf-edit').innerHTML = `${icon('edit', 14)}Bearbeiten`);
  fig._ed = null;
}

/* ---------- Ansicht: Bauen ---------- */
let buildRun = 0;
let loopOn = false;
let lastBuild = null;
let idle = true;

function findComp(text) {
  const t = norm(text);
  if (!t) return null;
  for (const c of F.components) {
    const keys = [c.id, c.name, ...(c.aliases || [])].map(norm).filter(Boolean);
    if (!keys.some(k => t.includes(k) || k.startsWith(t))) continue;
    const l = c.layouts.find(x => t.includes(norm(x.name)) || t.includes(norm(x.id))) || c.layouts[selIndex(c)];
    return { c, l };
  }
  return null;
}

function viewBuild(keep) {
  main.innerHTML = `<section class="v-build">
  ${errorsHTML()}
  <div class="b-stage" id="b-stage"></div>
  <div class="b-dock">
    <div class="b-log" id="b-log" aria-live="polite"></div>
    <form class="b-prompt" id="b-form" autocomplete="off">
      <button type="button" class="b-x" id="b-x" aria-label="Leeren">${icon('close', 16)}</button>
      <input id="b-in" placeholder="${F.live ? 'Neue Komponente beschreiben oder eine ändern …' : 'Komponente erzeugen …'}" spellcheck="false" aria-label="Komponente">
      <button type="submit" class="b-go" aria-label="Erzeugen"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>
    </form>
    ${F.live ? `<p class="b-live"><i></i>Verbunden mit Claude Code · Anfragen laufen über dein Konto</p>` : ''}
    <p class="b-meta">${esc(S.name)} · ${U > 1 ? `${U}-px-Raster` : 'Abstandsskala'} · Inset ${S.inset} · ${Object.keys(S.families).map(shortFam).join(' + ')} · max. ${S.limits.sizes} Größen</p>
    <div class="b-chips" id="b-chips">${F.components.map(c => `<button data-c="${esc(c.id)}">${esc(c.name)}</button>`).join('')}<label class="b-loop"><input type="checkbox" id="b-loop"${loopOn ? ' checked' : ''}><span>Endlos</span></label></div>
  </div>
</section>`;
  const form = document.getElementById('b-form'), input = document.getElementById('b-in');
  form.addEventListener('submit', e => { e.preventDefault(); submitBuild(input.value); });
  document.getElementById('b-x').addEventListener('click', () => { input.value = ''; input.focus(); });
  document.querySelectorAll('#b-chips button').forEach(b => b.addEventListener('click', () => {
    const c = F.byId[b.dataset.c];
    input.value = c.name;
    submitBuild(c.name);
  }));
  document.getElementById('b-loop').addEventListener('change', e => { loopOn = e.target.checked; if (loopOn && idle) autopilot(buildRun); });

  if (F.job && F.job.status !== 'done') {
    // Eine Anfrage läuft (oder ist gerade gescheitert): ihr echtes Protokoll zeigen, nichts anderes anstoßen
    buildRun++;
    idle = !jobRunning();
    attachJobLog(document.getElementById('b-log'));
    if (jobRunning()) {
      input.value = F.job.view === 'build' ? F.job.prompt : '';
      document.getElementById('b-stage').innerHTML = pendingHTML();
      const x = document.getElementById('b-x');
      x.title = 'Anfrage abbrechen';
      x.onclick = () => fetch('/api/cancel', { method: 'POST' });
    }
    return;
  }
  const start = state.c && F.byId[state.c] ? { c: F.byId[state.c], l: F.byId[state.c].layouts[selIndex(F.byId[state.c])] } : (keep && lastBuild);
  if (start) { input.value = start.c.name; runBuild(start.c, start.l, keep || STILL); }
  else if (!F.components.length) document.getElementById('b-stage').innerHTML = emptyHTML();
  else { logLine('Welche Komponente soll entstehen?'); if (!STILL) autopilot(buildRun, true); }
}

function logLine(text) {
  const log = document.getElementById('b-log');
  if (log) log.innerHTML = `<div class="b-head">${esc(text)}</div>`;
}
function makeLog(log = document.getElementById('b-log'), head = 'Denkt nach …') {
  log.classList.remove('bad');
  log.innerHTML = `<div class="b-head">${esc(head)}</div><ol class="b-steps"></ol>`;
  const ol = log.querySelector('ol');
  return {
    step(code) {
      [...ol.children].forEach(li => li.classList.add('old'));
      const li = document.createElement('li');
      li.innerHTML = `<i class="b-spin"></i><code>${esc(code)}</code><span></span>`;
      ol.appendChild(li);
      while (ol.children.length > 3) ol.firstElementChild.remove();
      return {
        done(detail) {
          if (!li.classList.contains('done')) { li.classList.add('done'); li.querySelector('i').outerHTML = icon('check', 14); }
          if (detail) li.querySelector('span').textContent = `→ ${detail}`;
        },
      };
    },
    finish(text, bad) { log.querySelector('.b-head').textContent = text; log.classList.toggle('bad', !!bad); },
    note(text) { const p = document.createElement('p'); p.className = 'b-note'; p.textContent = text; log.appendChild(p); },
  };
}

// Die Notiz, die Claude nach einer Anfrage hinterlassen hat (über den Neuladen hinweg)
function takeNote(id) {
  try {
    const n = JSON.parse(sessionStorage.getItem('cf.note') || 'null');
    if (!n || (id && n.id !== id)) return null;
    sessionStorage.removeItem('cf.note');
    return n;
  } catch { return null; }
}

function copyHint(log, head, prompt) {
  log.classList.remove('bad');
  log.innerHTML = `<div class="b-head">${esc(head)}</div><p class="b-miss">Diese Seite ist nicht mit Claude Code verbunden. Starte im Ordner <code>node tools/serve.mjs</code> und öffne http://localhost:4173 – dann geht die Anfrage direkt an Claude. Oder schreib Claude Code selbst:</p><div class="b-copy"><code>${esc(prompt)}</code><button type="button">Kopieren</button></div>`;
  const btn = log.querySelector('.b-copy button');
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(prompt); btn.textContent = 'Kopiert'; }
    catch { getSelection().selectAllChildren(log.querySelector('.b-copy code')); btn.textContent = 'Markiert'; }
  });
}

// Nur ein reiner Komponenten- (und Layout-)Name spielt ab; alles andere ist eine Anfrage an Claude.
function exactComp(text) {
  const t = norm(text);
  if (!t) return null;
  for (const c of F.components) {
    for (const k of [c.id, c.name, ...(c.aliases || [])].map(norm).filter(Boolean)) {
      if (t === k) return { c, l: c.layouts[selIndex(c)] };
      const l = c.layouts.find(x => t === `${k} ${norm(x.name)}` || t === `${k} ${norm(x.id)}`);
      if (l) return { c, l };
    }
  }
  return null;
}

/* ---------- Laufende Anfrage an Claude ---------- */
// Der Stand einer Anfrage hängt nicht an der Ansicht: Wer während der Arbeit die Ansicht wechselt und zurückkommt,
// sieht weiter die echten Arbeitsschritte, ebenso nach einem Neuladen (dann über /api/job wieder angehängt).
// Die Kopfzeile zeigt in jeder Ansicht, dass Claude arbeitet; „Bauen“ zeigt immer das Protokoll.
F.job = null;
const jobLogs = new Set();
function jobHTML(j) {
  const steps = j.steps.slice(-3);
  return `<div class="b-head">${esc(j.head)}</div><ol class="b-steps">${steps.map((st, i) => `<li class="${st.done ? 'done' : ''}${i < steps.length - 1 ? ' old' : ''}">${st.done ? icon('check', 14) : '<i class="b-spin"></i>'}<code>${esc(st.code)}</code><span>${st.detail ? `→ ${esc(st.detail)}` : ''}</span></li>`).join('')}</ol>`;
}
function paintJob() {
  const j = F.job;
  for (const el of [...jobLogs]) {
    if (!el.isConnected) { jobLogs.delete(el); continue; }
    if (!j) continue;
    el.classList.toggle('bad', j.status === 'error');
    el.innerHTML = jobHTML(j);
  }
  const chip = document.getElementById('cf-job');
  if (!chip) return;
  const run = j?.status === 'running';
  chip.hidden = !run || state.view === 'build';
  if (run) {
    const cur = j.steps[j.steps.length - 1];
    chip.innerHTML = `<i class="b-spin"></i><span>Claude arbeitet</span>${cur ? `<code>${esc(cur.code)}</code>` : ''}`;
    chip.title = `„${j.prompt.split('\n')[0].slice(0, 120)}“ – zum Protokoll in „Bauen“`;
  }
}
function attachJobLog(el) { if (!el) return; jobLogs.add(el); paintJob(); }
const jobRunning = () => F.job?.status === 'running';
function jobEvent(ev) {
  const j = F.job;
  if (!j) return;
  const cur = j.steps[j.steps.length - 1];
  if (ev.type === 'step') { if (cur) cur.done = true; j.steps.push({ code: ev.code, detail: '', done: false }); }
  else if (ev.type === 'detail') { if (cur) { cur.done = true; cur.detail = ev.text; } }
  else if (ev.type === 'done') {
    if (cur) cur.done = true;
    j.status = 'done';
    j.head = 'Fertig – lädt neu …';
    try { sessionStorage.setItem('cf.note', JSON.stringify({ id: ev.id, text: ev.text, cost: ev.cost })); } catch {}
    const p = new URLSearchParams({ view: j.view || 'build' });
    if (ev.id) p.set('c', ev.id);
    setTimeout(() => { location.href = `${location.pathname}?${p}`; }, 500);
  } else if (ev.type === 'error') {
    if (cur) cur.done = true;
    j.status = 'error';
    j.head = ev.text;
    window.__cfHold = false;
    idle = true;
  }
  paintJob();
}
async function readJob(res) {
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) { try { jobEvent(JSON.parse(line)); } catch {} }
    }
  }
  if (jobRunning()) jobEvent({ type: 'error', text: 'Die Verbindung zum Server ist abgerissen.' });
}

// Schickt eine Anfrage an Claude Code (tools/serve.mjs); die Arbeitsschritte erscheinen in `log` und in „Bauen“.
async function generate(prompt, { log, view = 'build', onStart, figma = false } = {}) {
  F.job = { prompt, view, status: 'running', head: 'Claude arbeitet …', steps: [] };
  window.__cfHold = true;
  attachJobLog(log);
  onStart?.();
  try {
    const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, system: SYS_ID, figma, view }) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Der Server antwortet mit ${res.status}.`); }
    await readJob(res);
  } catch (e) {
    if (jobRunning()) jobEvent({ type: 'error', text: e.message });
  }
}

// Seite neu geladen (oder in einem zweiten Fenster geöffnet), während Claude arbeitet: wieder anhängen
async function reattachJob(info) {
  F.job = { prompt: info.prompt || '', view: info.view || 'build', status: 'running', head: 'Claude arbeitet …', steps: [] };
  window.__cfHold = true;
  paintJob();
  try {
    const res = await fetch('/api/job', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Der Server antwortet mit ${res.status}.`);
    await readJob(res);
  } catch (e) {
    if (jobRunning()) jobEvent({ type: 'error', text: e.message });
  }
}

function pendingHTML() {
  const bp = { w: S.width, h: 240 };
  return `<div class="b-pending" style="width:${bp.w}px;height:${bp.h}px"><div class="cf-shell b-shell"></div><div class="b-l">${gridSVG(bp, { anim: true }).replace('is-anim"', 'is-anim is-drawing"')}</div></div>`;
}

function submitBuild(text) {
  if (jobRunning()) { toast('Claude arbeitet noch an der letzten Anfrage – warte kurz oder brich sie mit × ab.', true); return; }
  const exact = exactComp(text);
  const hit = exact || (!F.live ? findComp(text) : null);
  if (!hit) {
    buildRun++;
    idle = false;
    const log = document.getElementById('b-log');
    if (F.live) {
      const x = document.getElementById('b-x');
      generate(text.trim(), {
        log,
        onStart: () => {
          document.getElementById('b-stage').innerHTML = pendingHTML();
          x.title = 'Anfrage abbrechen';
          x.onclick = () => fetch('/api/cancel', { method: 'POST' });
        },
      });
      return;
    }
    const name = text.trim() || 'Neue Komponente';
    document.getElementById('b-stage').innerHTML = '';
    copyHint(log, `„${name}“ gibt es noch nicht.`, `Baue eine Komponente „${name}“ mit drei Layouts.`);
    idle = true;
    return;
  }
  state.c = hit.c.id; state.l = null;
  state.sel[hit.c.id] = hit.l.index; store.set('sel', state.sel);
  syncURL();
  runBuild(hit.c, hit.l, STILL);
}

async function runBuild(c, l, instant) {
  const run = ++buildRun;
  const alive = () => run === buildRun && document.getElementById('b-stage');
  const wait = async ms => { await sleep(ms); return alive(); };
  lastBuild = { c, l };
  idle = false;
  const bp = bpOf(c, l);
  const stage = document.getElementById('b-stage');
  const GAP = 40;
  stage.innerHTML = `<div class="b-track" id="b-track" style="gap:${GAP}px">
  <figure class="cf-slot b-main"><div class="b-stack" id="b-stack" style="width:${bp.w}px;height:${bp.h}px">
    <div class="cf-shell b-shell"></div>
    <div class="b-l b-grid">${gridSVG(bp, { anim: true })}</div>
    <div class="b-l b-areas">${areaRects(bp)}</div>
    <div class="b-l b-struct">${structInner(bp)}</div>
    <div class="b-l b-orig">${cardHTML(c, l)}</div>
  </div>${caption('original', bp)}</figure>
  ${LAYERS.slice(1).map((k, i) => `<figure class="cf-slot b-more" style="--k:${i}">${layerCard(k, bp)}${caption(k, bp)}</figure>`).join('')}
</div>`;
  const track = document.getElementById('b-track'), stack = document.getElementById('b-stack');
  const center = k => stage.clientWidth / 2 - (k * (bp.w + GAP) + bp.w / 2);
  track.style.transform = `translateX(${center(0)}px)`;
  const L = makeLog();
  const details = [`${bp.areas.length} Flächen`, `${bp.type.sizes.length} Größen · ${bp.type.weights.length} Schnitte`];
  const note = takeNote(c.id);
  const finish = () => {
    L.finish(bp.ok ? 'Fertig' : `Fertig · ${bp.violations.length} ${bp.violations.length === 1 ? 'Verstoß' : 'Verstöße'}`, !bp.ok);
    if (note?.text) {
      L.note(`Claude: ${note.text}`);
      if (F.live?.history) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ed-mini b-cmp'; b.textContent = 'Vorher / Nachher'; b.addEventListener('click', compareLatest); document.getElementById('b-log')?.appendChild(b); }
    }
  };

  if (instant) {
    stack.classList.add('no-anim', 'p-grid', 'p-areas', 'p-struct', 'p-orig');
    track.classList.add('is-done');
    ['grid.build', 'layout.defineAreas', 'typography.placeHierarchy', 'widget.renderContent'].forEach((s, i) => L.step(`${s}()`).done(details[i - 1]));
    finish();
    idle = true;
    return;
  }

  const s1 = L.step(`grid.build({ unit: ${U}, cols: ${Math.round(bp.w / U)}, rows: ${Math.round(bp.h / U)} })`);
  await sleep(60);
  stack.classList.add('p-grid');
  stack.querySelector('.cf-grid').classList.add('is-drawing');
  if (!await wait(1700)) return;
  s1.done(`${Math.round(bp.w / U) * Math.round(bp.h / U)} Zellen`);
  const s2 = L.step('layout.defineAreas()');
  stack.classList.add('p-areas');
  if (!await wait(700 + bp.areas.length * 110 + 500)) return;
  s2.done(details[0]);
  const s3 = L.step('typography.placeHierarchy()');
  stack.classList.add('p-struct');
  const nText = stack.querySelectorAll('.b-struct .cf-wt').length;
  if (!await wait(700 + Math.min(nText, 30) * 40 + 700)) return;
  s3.done(details[1]);
  const s4 = L.step('widget.renderContent()');
  stack.classList.add('p-orig');
  if (!await wait(1100)) return;
  s4.done(bp.ok ? 'im Raster' : 'mit Verstößen');
  finish();
  track.classList.add('is-done');
  if (!await wait(1400)) return;

  // Kamerafahrt über die Schichten
  const pan = (to, ms) => track.animate([{ transform: track.style.transform }, { transform: `translateX(${to}px)` }], { duration: ms, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }).finished.then(() => { track.style.transform = `translateX(${to}px)`; });
  const last = Math.min(LAYERS.length - 1, 3);
  await pan(center(last), 4600);
  if (!await wait(1400)) return;
  await pan(center(0), 2200);
  if (!await wait(1200)) return;
  idle = true;
  if (loopOn) autopilot(run);
}

async function autopilot(run, force) {
  if ((!loopOn && !force) || !F.components.length) return;
  const seq = F.components.flatMap(c => c.layouts.map(l => ({ c, l })));
  const cur = lastBuild ? seq.findIndex(x => x.c === lastBuild.c && x.l === lastBuild.l) : -1;
  const next = seq[(cur + 1) % seq.length];
  const input = document.getElementById('b-in');
  if (!input || run !== buildRun) return;
  const text = `${next.c.name} ${next.l.name}`;
  input.value = '';
  for (const ch of text) { input.value += ch; await sleep(55); if (run !== buildRun || !document.getElementById('b-in')) return; }
  await sleep(350);
  if (run !== buildRun) return;
  state.c = next.c.id; state.sel[next.c.id] = next.l.index; syncURL();
  runBuild(next.c, next.l, false);
}

/* ---------- Ansicht: Fabrik (Canvas mit Kamerafahrt) ---------- */
let CV = null;
function stopCanvas() {
  if (!CV) return;
  CV.alive = false;
  window.removeEventListener('resize', CV.onResize);
  CV = null;
}
function viewCanvas() {
  const comps = F.components;
  if (!comps.length) { main.innerHTML = emptyHTML(); return; }
  const GAP = 48, LABEL = 32;
  const all = [];
  const maxL = Math.max(...comps.map(c => c.layouts.length));
  for (let li = 0; li < maxL; li++) for (const c of comps) if (c.layouts[li]) all.push({ c, l: c.layouts[li], bp: bpOf(c, c.layouts[li]) });
  const colW = Math.max(...all.map(x => x.bp.w));
  const cols = Math.max(3, Math.min(8, Math.round(Math.sqrt(all.length * 1.5))));
  const hs = Array(cols).fill(0);
  all.forEach(it => {
    const col = hs.indexOf(Math.min(...hs));
    it.x = col * (colW + GAP); it.y = hs[col]; it.w = it.bp.w; it.h = it.bp.h;
    hs[col] += LABEL + it.h + GAP;
  });
  const WW = cols * (colW + GAP) - GAP, WH = Math.max(...hs) - GAP;
  main.innerHTML = `<section class="v-canvas" id="cv">
  <div class="cv-world" id="cv-world" style="width:${WW}px;height:${WH}px">${all.map((it, k) => `<div class="cv-item" data-k="${k}" style="left:${it.x}px;top:${it.y}px;width:${it.w}px">
    <div class="cv-label"><span>${esc(it.c.name)}</span><span>${pad2(it.l.index + 1)} ${esc(it.l.name)}</span></div>${cardHTML(it.c, it.l)}</div>`).join('')}</div>
  <div class="cv-ui"><button class="cf-btn" id="cv-play"></button><button class="cf-btn" id="cv-fit">Übersicht</button><span class="cv-hint">Ziehen zum Verschieben · ⌘ + Scrollen zum Zoomen</span></div>
</section>`;
  const cv = document.getElementById('cv'), world = document.getElementById('cv-world');
  all.forEach((it, k) => { it.el = world.children[k]; });
  const me = CV = { alive: true, playing: !STILL, token: 0, cam: { x: WW / 2, y: WH / 2, s: 1 } };
  const vw = () => cv.clientWidth, vh = () => cv.clientHeight;
  const apply = () => { const { x, y, s } = me.cam; world.style.transform = `translate(${vw() / 2 - x * s}px, ${vh() / 2 - y * s}px) scale(${s})`; };
  const overview = () => ({ x: WW / 2, y: WH / 2, s: Math.min(vw() / (WW + 160), vh() / (WH + 160)) });
  me.cam = overview(); apply();
  me.onResize = () => apply();
  window.addEventListener('resize', me.onResize);

  const playBtn = document.getElementById('cv-play');
  const renderPlay = () => { playBtn.innerHTML = me.playing ? `${icon('pause', 16)}Kamerafahrt anhalten` : `${icon('play', 16)}Kamerafahrt starten`; };
  renderPlay();
  const alive = tok => () => me.alive && me.playing && me.token === tok;
  const wait = (ms, ok) => new Promise(res => { const t0 = performance.now(); const tick = () => (!ok() || performance.now() - t0 >= ms) ? res() : requestAnimationFrame(tick); tick(); });
  const fly = (to, ms, ok) => new Promise(res => {
    const from = { ...me.cam }, t0 = performance.now();
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = now => {
      if (!ok()) return res();
      const t = Math.min(1, (now - t0) / ms), e = ease(t);
      me.cam = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, s: Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * e) };
      apply();
      t < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
  let twin = null, focused = null;
  const unfocus = () => {
    world.classList.remove('is-focus');
    focused?.el.classList.remove('is-focused'); focused = null;
    if (twin) { const t = twin; t.classList.remove('in'); setTimeout(() => t.remove(), 500); twin = null; }
  };
  const focus = it => {
    focused = it;
    world.classList.add('is-focus');
    it.el.classList.add('is-focused');
    twin = document.createElement('div');
    twin.className = 'cv-twin';
    twin.style.cssText = `left:${it.x + it.w + 24}px;top:${it.y + LABEL}px`;
    twin.innerHTML = `${layerCard(Math.random() < .5 ? 'pixels' : 'areas', it.bp)}<div class="cv-twin-meta"><div><b>Höhe</b>${it.h} px</div><div><b>Radius</b>${S.radius} px</div></div>`;
    world.appendChild(twin);
    requestAnimationFrame(() => requestAnimationFrame(() => twin && twin.classList.add('in')));
  };
  const focusCam = it => {
    const s = Math.min(1.6, (vh() * .64) / it.h, (vw() * .42) / it.w);
    return { x: it.x + it.w + 12, y: it.y + LABEL + it.h / 2, s };
  };
  let lastK = -1;
  const pick = () => { let k; do k = Math.floor(Math.random() * all.length); while (all.length > 1 && k === lastK); lastK = k; return all[k]; };
  async function pilot() {
    const ok = alive(++me.token);
    while (ok()) {
      await fly(overview(), 2400, ok); if (!ok()) break;
      await wait(1800, ok);
      for (let n = 0; n < 3 && ok(); n++) {
        const it = pick();
        await fly(focusCam(it), n ? 2000 : 2800, ok); if (!ok()) break;
        focus(it);
        await wait(3600, ok);
        unfocus();
        await wait(400, ok);
      }
    }
    unfocus();
  }
  const pause = () => { if (!me.playing) return; me.playing = false; me.token++; unfocus(); renderPlay(); };
  playBtn.addEventListener('click', () => { if (me.playing) pause(); else { me.playing = true; renderPlay(); pilot(); } });
  document.getElementById('cv-fit').addEventListener('click', () => { pause(); fly(overview(), 900, () => me.alive); });

  let drag = null;
  cv.addEventListener('pointerdown', e => {
    if (e.target.closest('.cv-ui')) return;
    pause();
    drag = { x: e.clientX, y: e.clientY, cx: me.cam.x, cy: me.cam.y };
    cv.setPointerCapture(e.pointerId);
    cv.classList.add('is-drag');
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    me.cam.x = drag.cx - (e.clientX - drag.x) / me.cam.s;
    me.cam.y = drag.cy - (e.clientY - drag.y) / me.cam.s;
    apply();
  });
  const endDrag = () => { drag = null; cv.classList.remove('is-drag'); };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    pause();
    if (e.ctrlKey || e.metaKey) {
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left - vw() / 2, py = e.clientY - r.top - vh() / 2;
      const wx = me.cam.x + px / me.cam.s, wy = me.cam.y + py / me.cam.s;
      const ns = Math.max(.08, Math.min(3, me.cam.s * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .002))));
      me.cam = { x: wx - px / ns, y: wy - py / ns, s: ns };
    } else {
      me.cam.x += e.deltaX / me.cam.s;
      me.cam.y += e.deltaY / me.cam.s;
    }
    apply();
  }, { passive: false });

  if (me.playing) pilot();
}

/* ---------- Übergabe: Tokens, HTML/CSS und Figma-Daten ---------- */
// Läuft im Browser (tools/export.mjs ruft es headless auf). Liefert reine Daten; Dateien schreibt das Werkzeug.
const r2 = v => Math.round(v * 100) / 100;
function cssTextOf(match) {
  const out = [];
  for (const sheet of document.styleSheets) {
    if (!match(sheet.href || '')) continue;
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules) if (!(r instanceof CSSImportRule)) out.push(r.cssText);
  }
  return out.join('\n');
}

// Laufzeit für Web Components: dieselben Helfer wie in der Fabrik, als Quelltext
F.exportRuntime = () => ({
  icons: ICONS,
  system: (({ rules, ...rest }) => rest)(S),
  code: [
    `const esc = ${esc};`, `const hash = ${hash};`, `const pad2 = ${pad2};`, 'let NOW = new Date();',
    zoned.toString(), placeholder.toString(),
    `const SLOTS = ${JSON.stringify(SLOTS)};`, `const mergedCSS = ${mergedCSS};`, `const areaSel = ${areaSel};`, `const isLeaf = ${isLeaf};`,
    leavesOf.toString(), resolveText.toString(), resolveEl.toString(), setLeafText.toString(), applyTweaks.toString(),
  ].join('\n'),
  componentCSS: Object.fromEntries([...document.querySelectorAll('style[data-component]')].map(st => [st.dataset.component, st.textContent])),
});

F.exportTokens = () => ({
  system: SYS_ID, name: S.name, version: S.version,
  colors: tokenPalette().map(t => ({ name: t.name, hex: hexOf(t.rgb), a: r2(t.a) })),
  spacing: S.spacing, radius: { card: S.radius, inner: S.innerRadii }, grid: { unit: U, inset: S.inset, width: S.width, widths: widthsOf() },
  families: S.families, typeScale: S.typeScale, lineHeights: S.lineHeightRatios || { step: S.lineHeightStep },
  textStyles: S.textStyles.map(t => ({ ...t, family: styleFamily(t) })),
});

F.exportHTML = cid => {
  const c = F.byId[cid];
  if (!c) throw new Error(`Unbekannte Komponente ${cid}`);
  const sysCSS = cssTextOf(h => h.includes(`/systems/${SYS_ID}/system.css`));
  // Schriften des Regelwerks (z. B. systems/zds/fonts.css) relativ einbinden – Lizenzschriften werden nie kopiert
  const fontLinks = [];
  for (const sheet of document.styleSheets) { if (!(sheet.href || '').includes(`/systems/${SYS_ID}/system.css`)) continue; try { for (const r of sheet.cssRules) if (r instanceof CSSImportRule) fontLinks.push(`<link rel="stylesheet" href="../../../systems/${SYS_ID}/${r.href.split('/').pop()}">`); } catch {} }
  const compCSS = [...document.querySelectorAll('style[data-component]')].filter(s => s.dataset.component === cid).map(s => s.textContent).join('\n');
  const cards = c.layouts.map(l => `<figure><figcaption><b>${esc(l.name)}</b> <span>${l.width} × ${bpOf(c, l).h} px</span></figcaption>\n${cardHTML(c, l)}\n${l.idea ? `<p>${esc(l.idea)}</p>` : ''}</figure>`).join('\n');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.name)} · ${esc(S.name)}</title>
<!-- Übergabe aus der Component Factory: Regelwerk „${esc(S.name)}“ (systems/${SYS_ID}), Komponente components/${cid}.js, Stand ${new Date().toISOString().slice(0, 10)}.
     Tokens und Typo-Klassen stehen im ersten <style>, die Komponente selbst im zweiten (auf [data-c="${cid}"] begrenzt). -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Libre+Baskerville:ital,wght@0,400;1,400&display=swap">
${fontLinks.join('\n')}
<style>
${sysCSS}
</style>
<style>
${compCSS}
</style>
<style>
body { margin: 0; padding: 40px; background: #f7f7f5; font: 14px/20px system-ui, sans-serif; color: #1b1b1b; }
.handoff { display: flex; flex-wrap: wrap; gap: 40px; align-items: flex-start; }
.handoff figure { margin: 0; }
.handoff figcaption { margin-bottom: 12px; }
.handoff figcaption span, .handoff figure > p { color: #6b6b6b; font-size: 12px; }
.handoff figure > p { max-width: ${S.width}px; }
</style>
</head>
<body>
<h1 style="font-size:20px;font-weight:500;margin:0 0 24px">${esc(c.name)} <span style="color:#9e9e9e;font-weight:400">· ${esc(S.name)}</span></h1>
<div class="handoff">
${cards}
</div>
</body>
</html>
`;
};

// Figma-Daten: jede Karte als Baum aus Rahmen (mit Auto-Layout, wo das CSS Flex ist), Texten (mit Stil-Läufen), SVG und Medien.
function figmaColor(v) {
  const c = parseColor(v);
  if (!c || c.a < .01) return null;
  return { hex: hexOf(c.rgb), a: r2(c.a), token: matchToken(c) };
}
function figmaShadows(v) {
  if (!v || v === 'none') return [];
  return v.split(/,(?![^(]*\))/).map(s => {
    const col = s.match(/rgba?\([^)]+\)|color\([^)]+\)|#[0-9a-f]{3,8}/i)?.[0];
    const nums = s.replace(col || '', '').match(/-?[\d.]+px/g)?.map(parseFloat) || [];
    return col ? { color: figmaColor(col), x: nums[0] || 0, y: nums[1] || 0, blur: nums[2] || 0, spread: nums[3] || 0, inset: /inset/.test(s) } : null;
  }).filter(x => x && x.color);
}
const figmaRadii = cs => ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(k => parseFloat(cs[`border${k}Radius`]) || 0);
function figmaStroke(cs) {
  const sides = ['Top', 'Right', 'Bottom', 'Left'].map(sd => ({ w: cs[`border${sd}Style`] === 'none' ? 0 : parseFloat(cs[`border${sd}Width`]) || 0, color: figmaColor(cs[`border${sd}Color`]) }));
  if (!sides.some(s => s.w && s.color)) return null;
  const first = sides.find(s => s.w && s.color);
  return { color: first.color, weights: sides.map(s => (s.color ? s.w : 0)) };
}
function figmaRuns(el) {
  const runs = [];
  let text = '';
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode, p = n.parentElement, cs = getComputedStyle(p);
    if (cs.display === 'none') continue;
    let t = n.nodeValue.replace(/\s+/g, ' ');
    if (!text || text.endsWith(' ')) t = t.replace(/^ /, '');
    if (!t) continue;
    if (cs.textTransform === 'uppercase') t = t.toUpperCase();
    const lh = cs.lineHeight === 'normal' ? null : r2(parseFloat(cs.lineHeight));
    const style = { family: normFamily(cs.fontFamily), size: r2(parseFloat(cs.fontSize)), weight: parseInt(cs.fontWeight, 10) || 400, italic: cs.fontStyle === 'italic', lh, ls: cs.letterSpacing === 'normal' ? 0 : r2(parseFloat(cs.letterSpacing)), color: figmaColor(cs.color), strike: cs.textDecorationLine.includes('line-through'), tabular: cs.fontVariantNumeric.includes('tabular') };
    const last = runs[runs.length - 1];
    if (last && JSON.stringify(last.style) === JSON.stringify(style)) last.end += t.length;
    else runs.push({ start: text.length, end: text.length + t.length, style });
    text += t;
  }
  const trimmed = text.replace(/\s+$/, '');
  runs.forEach(r => { r.end = Math.min(r.end, trimmed.length); });
  return { characters: trimmed, runs: runs.filter(r => r.end > r.start) };
}
const INLINE = /^(SPAN|EM|B|STRONG|I|A|SMALL|SUP|SUB|BR|CODE|MARK|S|U)$/;
function figmaNode(el, cb) {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) return null;
  const br = el.getBoundingClientRect();
  const base = {
    name: el.dataset?.area || el.getAttribute('aria-label') || (el.classList?.[0] ? `.${el.classList[0]}` : el.tagName.toLowerCase()),
    area: el.dataset?.area || null,
    x: r2(br.left - cb.left), y: r2(br.top - cb.top), w: r2(br.width), h: r2(br.height),
    opacity: parseFloat(cs.opacity),
    abs: cs.position === 'absolute',
    grow: parseFloat(cs.flexGrow) > 0,
    alignSelf: cs.alignSelf,
  };
  if (el instanceof SVGSVGElement) {
    const clone = el.cloneNode(true);
    const color = cs.color;
    clone.setAttribute('width', br.width); clone.setAttribute('height', br.height);
    clone.querySelectorAll('*').forEach(k => {
      for (const at of ['fill', 'stroke']) if (k.getAttribute(at) === 'currentColor') k.setAttribute(at, color);
      const st = k.getAttribute('style') || '';
      if (/var\(/.test(st) || /var\(/.test(k.getAttribute('fill') || '') || /var\(/.test(k.getAttribute('stroke') || '')) {
        const kc = getComputedStyle(el.querySelectorAll('*')[[...clone.querySelectorAll('*')].indexOf(k)]);
        if (/var\(/.test(k.getAttribute('fill') || '')) k.setAttribute('fill', kc.fill);
        if (/var\(/.test(k.getAttribute('stroke') || '')) k.setAttribute('stroke', kc.stroke);
        k.removeAttribute('style');
        k.setAttribute('font-family', normFamily(kc.fontFamily));
      }
      k.classList?.remove('cf-spin');
    });
    if (clone.getAttribute('stroke') === 'currentColor') clone.setAttribute('stroke', color);
    if (clone.getAttribute('fill') === 'currentColor') clone.setAttribute('fill', color);
    return { ...base, type: 'svg', svg: clone.outerHTML, icon: el.classList.contains('icon') ? (el.dataset.icon || null) : null, color: figmaColor(color) };
  }
  if (el.matches('[data-media]')) {
    return { ...base, type: 'media', fill: figmaColor(cs.backgroundColor), radius: figmaRadii(cs), img: el.querySelector('img')?.currentSrc || null, bleed: el.hasAttribute('data-bleed') };
  }
  const kids = [...el.childNodes];
  const hasText = kids.some(n => n.nodeType === 3 && n.nodeValue.trim());
  const elemKids = kids.filter(n => n.nodeType === 1 && !/^(STYLE|SCRIPT)$/.test(n.tagName));
  const inlineOnly = elemKids.every(k => INLINE.test(k.tagName) && getComputedStyle(k).display.startsWith('inline'));
  const frame = {
    ...base, type: 'frame',
    fill: figmaColor(cs.backgroundColor), gradient: cs.backgroundImage !== 'none' ? cs.backgroundImage : null,
    radius: figmaRadii(cs), stroke: figmaStroke(cs), shadows: figmaShadows(cs.boxShadow),
    clip: /hidden|clip/.test(cs.overflowX + cs.overflowY),
    pad: ['Top', 'Right', 'Bottom', 'Left'].map(sd => parseFloat(cs[`padding${sd}`]) || 0),
  };
  if (hasText && inlineOnly) {
    const txt = { ...base, type: 'text', ...figmaRuns(el), align: cs.textAlign, truncate: cs.textOverflow === 'ellipsis', clamp: cs.webkitLineClamp && cs.webkitLineClamp !== 'none' ? +cs.webkitLineClamp : null, nowrap: cs.whiteSpace === 'nowrap' };
    // Text mit eigener Fläche (Chip, Button-Beschriftung): Rahmen mit Text darin
    if (frame.fill || frame.stroke || frame.pad.some(Boolean) || frame.radius.some(Boolean)) {
      const inner = { ...txt, name: 'Text', area: null, x: base.x + frame.pad[3], y: base.y + frame.pad[0], w: r2(base.w - frame.pad[1] - frame.pad[3]), h: r2(base.h - frame.pad[0] - frame.pad[2]), abs: false, grow: false };
      return { ...frame, layout: { dir: 'H', gap: 0, justify: cs.justifyContent === 'normal' ? (cs.textAlign === 'center' ? 'center' : 'flex-start') : cs.justifyContent, align: 'center', wrap: false }, children: [inner] };
    }
    return txt;
  }
  if (/flex/.test(cs.display)) {
    const dir = cs.flexDirection.startsWith('column') ? 'V' : 'H';
    frame.layout = { dir, gap: parseFloat(dir === 'V' ? cs.rowGap : cs.columnGap) || 0, crossGap: parseFloat(dir === 'V' ? cs.columnGap : cs.rowGap) || 0, justify: cs.justifyContent, align: cs.alignItems, wrap: cs.flexWrap === 'wrap', reverse: cs.flexDirection.endsWith('reverse') };
  }
  const children = [];
  for (const n of kids) {
    if (n.nodeType === 1) { const k = figmaNode(n, cb); if (k) children.push(k); }
    else if (n.nodeType === 3 && n.nodeValue.trim()) {
      // Text neben Elementen: als eigener Text mit der Lage aus dem Range
      const rg = document.createRange(); rg.selectNodeContents(n);
      const rr = rg.getBoundingClientRect();
      const style = getComputedStyle(el);
      const t = { characters: n.nodeValue.replace(/\s+/g, ' ').trim(), runs: [] };
      t.runs = [{ start: 0, end: t.characters.length, style: { family: normFamily(style.fontFamily), size: r2(parseFloat(style.fontSize)), weight: parseInt(style.fontWeight, 10) || 400, italic: style.fontStyle === 'italic', lh: style.lineHeight === 'normal' ? null : r2(parseFloat(style.lineHeight)), ls: 0, color: figmaColor(style.color), strike: false, tabular: false } }];
      children.push({ type: 'text', name: 'Text', area: null, x: r2(rr.left - cb.left), y: r2(rr.top - cb.top), w: r2(rr.width), h: r2(rr.height), opacity: 1, abs: false, grow: false, alignSelf: 'auto', ...t, align: 'left', truncate: false, clamp: null, nowrap: true });
    }
  }
  // Reihenfolge wie dargestellt (CSS order)
  if (frame.layout) children.sort((a, b) => (frame.layout.dir === 'V' ? a.y - b.y : a.x - b.x) * (frame.layout.reverse ? -1 : 1));
  frame.children = children;
  return frame;
}
F.exportFigma = cid => {
  const c = F.byId[cid];
  if (!c) throw new Error(`Unbekannte Komponente ${cid}`);
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:0;top:0;';
  document.body.appendChild(host);
  try {
    const layouts = c.layouts.map(l => {
      host.innerHTML = cardHTML(c, l);
      const card = host.firstElementChild;
      const tree = figmaNode(card, card.getBoundingClientRect());
      tree.name = l.name;
      const bp = bpOf(c, l);
      return { id: l.id, name: l.name, idea: l.idea || '', w: tree.w, h: tree.h, family: l.family || null, variantOf: l.variantOf || null, ok: bp?.ok ?? null, tree };
    });
    return { system: SYS_ID, systemName: S.name, component: { id: c.id, name: c.name }, tokens: F.exportTokens().colors, layouts, created: new Date().toISOString() };
  } finally { host.remove(); }
};

/* ---------- Prüfbericht (für tools/check.mjs) ---------- */
function writeReport() {
  const report = {
    system: { id: SYS_ID, name: S.name, version: S.version, unit: U, inset: S.inset, limits: S.limits },
    loadErrors: F.loadErrors,
    components: F.components.map(c => ({
      id: c.id, name: c.name,
      layouts: c.layouts.map(l => {
        const b = bpOf(c, l);
        return { id: l.id, name: l.name, w: b.w, h: b.h, areas: b.areas.length, type: { sizes: b.type.sizes, weights: b.type.weights, families: b.type.families }, violations: b.violations, warnings: b.warnings || [], accepted: b.accepted || [] };
      }),
    })),
  };
  if (Q.has('states')) report.states = F.components.flatMap(c => statesResults(c).flatMap(r => r.bps.filter(b => !b.ok).map(b => ({ c: c.id, name: c.name, l: b.l, lname: b.lname, scenario: `Zustand ${r.name}`, violations: b.violations }))));
  if (Q.has('widths')) report.widths = widthsOf().filter(w => w !== S.width).flatMap(w => widthResults(w).filter(x => !x.bp.ok).map(x => ({ c: x.c.id, name: x.c.name, l: x.l.id, lname: x.l.name, scenario: `${w} px breit`, violations: x.bp.violations })));
  if (Q.has('stress')) {
    report.stress = F.components.flatMap(c => stressResults(c).flatMap(r => r.bps.filter(b => !b.ok).map(b => ({ c: c.id, name: c.name, l: b.l, lname: b.lname, scenario: r.name, violations: b.violations }))));
  }
  const el = document.createElement('script');
  el.type = 'application/json';
  el.id = 'cf-report';
  el.textContent = JSON.stringify(report).replace(/</g, '\\u003c');
  document.body.appendChild(el);
  document.documentElement.dataset.done = '1';
}

/* ---------- Start ---------- */
async function fontsReady() {
  const loads = Object.keys(S.families).flatMap(f => ['400', '500', '600', '700'].map(w => document.fonts.load(`${w} 16px "${f}"`)).concat([document.fonts.load(`italic 400 16px "${f}"`)]));
  await Promise.race([Promise.allSettled(loads), sleep(4000)]);
  await Promise.race([document.fonts.ready, sleep(1000)]);
}

async function boot() {
  await fontsReady();
  measureAll();
  if (CHECK) { writeReport(); return; }
  if (location.protocol.startsWith('http')) {
    try {
      const r = await fetch('/api/status', { cache: 'no-store' });
      const j = r.ok && r.headers.get('content-type')?.includes('json') ? await r.json() : null;
      if (j?.claude) F.live = j;
    } catch {}
  }
  if (F.live?.busy) reattachJob(F.live.job || {});
  document.documentElement.style.setProperty('--cf-radius', `${S.radius}px`);
  if (Q.has('still')) document.documentElement.classList.add('is-still');
  initChrome();
  route();
  document.documentElement.dataset.ready = '1';
}
})();

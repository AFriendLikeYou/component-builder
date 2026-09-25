// Schreibt systems/<id>/system.js aus einem SYSTEM-Objekt neu – mit denselben Kommentaren wie von Hand.
// Wird von tools/serve.mjs benutzt, wenn Regeln in der Ansicht „Regeln“ angepasst und übernommen werden.
// Unbekannte Schlüssel gehen nicht verloren: Sie landen am Ende unter „weitere Werte“.
const q = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
const val = v => (v == null ? 'null' : typeof v === 'string' ? q(v) : typeof v === 'number' || typeof v === 'boolean' ? String(v)
  : Array.isArray(v) ? `[${v.map(val).join(', ')}]` : inline(v));
const key = k => (/^[a-z_$][\w$]*$/i.test(k) ? k : q(k));
const inline = o => `{ ${Object.entries(o).map(([k, v]) => `${key(k)}: ${val(v)}`).join(', ')} }`;

const KNOWN = ['name', 'id', 'version', 'unit', 'gridView', 'inset', 'radius', 'width', 'innerRadii', 'spacing', 'minTarget', 'families', 'headline',
  'typeScale', 'lineHeightStep', 'widths', 'lineHeightRatios', 'limits', 'areaRoles', 'tokenPrefixes', 'accentFamilies', 'textStyles', 'atoms', 'rules'];

export function validSystem(S) {
  const num = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 512;
  return S && num(S.unit) && S.unit > 0 && num(S.inset) && num(S.radius) && num(S.width)
    && Array.isArray(S.innerRadii) && Array.isArray(S.spacing) && Array.isArray(S.typeScale) && S.typeScale.every(num)
    && (S.minTarget == null || num(S.minTarget))
    && ((num(S.lineHeightStep) && S.lineHeightStep > 0) || (Array.isArray(S.lineHeightRatios) && S.lineHeightRatios.length))
    && S.limits && ['families', 'sizes', 'weights'].every(k => num(S.limits[k]))
    && S.families && typeof S.families === 'object' && Array.isArray(S.areaRoles) && Array.isArray(S.textStyles)
    && (S.atoms == null || (Array.isArray(S.atoms) && S.atoms.every(a => a && typeof a.id === 'string' && typeof a.name === 'string' && typeof a.match === 'string')))
    && Array.isArray(S.rules) && S.rules.every(r => r && typeof r.id === 'string' && typeof r.title === 'string' && typeof r.text === 'string' && Array.isArray(r.checks));
}

const line = (cond, text) => (cond ? `${text}\n` : '');

export function renderSystemJS(S) {
  const extra = Object.keys(S).filter(k => !KNOWN.includes(k));
  const rule = r => {
    const opt = [r.level ? `level: ${q(r.level)}` : '', r.ctl ? `ctl: ${val(r.ctl)}` : '', r.fig ? `fig: ${q(r.fig)}` : ''].filter(Boolean).join(', ');
    return `    {
      id: ${q(r.id)}, title: ${q(r.title)}, checks: ${val(r.checks)},${opt ? ` ${opt},` : ''}
      text: ${q(r.text)},
    },`;
  };
  return `// Das Regelwerk „${S.name}“ als Daten – die einzige Quelle für seine Regeln und Werte.
// Die Prüfung (tools/check.mjs), die Schichten, die Ansicht „Regeln“ und Claude lesen von hier.
// Ändern hier oder in der Ansicht „Regeln“. Danach \`node tools/check.mjs --system ${S.id}\` laufen lassen.
window.SYSTEM = {
  name: ${q(S.name)},
  id: ${q(S.id)},
  version: ${q(S.version)},

  unit: ${S.unit},          // Raster für Lage und Größe der Flächen (1 = kein Raster)
${line(S.gridView != null, `  gridView: ${S.gridView},      // Abstand der Linien in der Pixel-Schicht`)}  inset: ${S.inset},        // Innenabstand der Karte; nur Flächen mit data-bleed dürfen näher an den Rand
  radius: ${S.radius},       // Außenradius der Karte
  width: ${S.width},       // Standardbreite
  innerRadii: ${val(S.innerRadii)}, // erlaubte Radien für Flächen und Medien; 'pill' = Pille oder Kreis
  spacing: ${val(S.spacing)}, // Abstände (gap, Innenabstand)
  minTarget: ${S.minTarget ?? 32},     // Mindestgröße für Bedienelemente in px
${line(S.widths, `  widths: ${val(S.widths)}, // Breakpoints: Kartenbreiten, in denen die Layouts geprüft werden`)}
  families: {       // erlaubte Familien und wofür sie da sind
${Object.entries(S.families).map(([k, v]) => `    ${q(k)}: ${q(v)},`).join('\n')}
  },
${line(S.headline, `  headline: ${val(S.headline)}, // diese Familie nur für Überschriften ab min px`)}  typeScale: ${val(S.typeScale)}, // erlaubte Schriftgrößen in px
${line(S.lineHeightStep != null, `  lineHeightStep: ${S.lineHeightStep},                           // Zeilenhöhen sind Vielfache davon`)}${line(S.lineHeightRatios, `  lineHeightRatios: ${val(S.lineHeightRatios)}, // Zeilenhöhe = Schriftgröße × einer dieser Faktoren`)}  limits: ${inline(S.limits)}, // pro Layout

  areaRoles: ${val(S.areaRoles)},
${line(S.tokenPrefixes, `  tokenPrefixes: ${val(S.tokenPrefixes)}, // CSS-Variablen, die als Farb-Tokens zählen`)}${S.accentFamilies ? `  accentFamilies: {  // Akzentfamilien: höchstens eine pro Layout
${Object.entries(S.accentFamilies).map(([k, v]) => `    ${q(k)}: ${val(v)},`).join('\n')}
  },
` : ''}
  // Benannte Textstile. Der Bearbeiten-Modus bietet nur diese an; die Grenzen oben gelten weiter.
  textStyles: [
${S.textStyles.map(t => `    ${inline(t)},`).join('\n')}
  ],
${S.atoms ? `
  // Bausteine: Bedienelemente und kleine Teile, aus denen die Komponenten gebaut werden (CSS in system.css).
  // match = woran die Prüfung den Baustein erkennt · variants = Zusatzklassen mit Namen · control: false = nicht bedienbar.
  // sample = Beispiel für die Übersicht: {v} = Variantenklassen, {icon:name:größe} = Icon. Fehlt ein Baustein, hier aufnehmen statt nachbauen.
  atoms: [
${S.atoms.map(t => `    ${inline(t)},`).join('\n')}
  ],
` : ''}
  // Die Regeln. \`checks\` = Kürzel der Messungen in measure() (factory/factory.js); nur diese zählen. Leer = nicht gemessen.
  // \`ctl\` = Werte, die die Ansicht „Regeln“ zum Einstellen anbietet. \`code\` in Backticks wird als Code gesetzt.
  // {unit}, {inset}, {limits.sizes} … sind Platzhalter für die Werte oben.
  rules: [
${S.rules.map(rule).join('\n')}
  ],
${extra.length ? `\n  // weitere Werte\n${extra.map(k => `  ${key(k)}: ${JSON.stringify(S[k])},`).join('\n')}\n` : ''}};
`;
}

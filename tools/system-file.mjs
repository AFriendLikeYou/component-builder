// Schreibt factory/system.js aus einem SYSTEM-Objekt neu – mit denselben Kommentaren wie von Hand.
// Wird von tools/serve.mjs benutzt, wenn Regeln in der Ansicht „Regeln“ angepasst und übernommen werden.
const q = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
const val = v => (typeof v === 'string' ? q(v) : typeof v === 'number' ? String(v) : Array.isArray(v) ? `[${v.map(val).join(', ')}]` : JSON.stringify(v));
const inline = o => `{ ${Object.entries(o).map(([k, v]) => `${/^[a-z_$][\w$]*$/i.test(k) ? k : q(k)}: ${val(v)}`).join(', ')} }`;

export function validSystem(S) {
  const num = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 512;
  return S && num(S.unit) && S.unit > 0 && num(S.inset) && num(S.radius) && num(S.width)
    && Array.isArray(S.innerRadii) && Array.isArray(S.spacing) && Array.isArray(S.typeScale) && S.typeScale.every(num)
    && num(S.lineHeightStep) && S.lineHeightStep > 0 && S.limits && ['families', 'sizes', 'weights'].every(k => num(S.limits[k]))
    && S.families && typeof S.families === 'object' && Array.isArray(S.areaRoles) && Array.isArray(S.textStyles)
    && Array.isArray(S.rules) && S.rules.every(r => r && typeof r.id === 'string' && typeof r.title === 'string' && typeof r.text === 'string' && Array.isArray(r.checks));
}

export function renderSystemJS(S) {
  return `// Das Regelwerk als Daten – die einzige Quelle für Regeln und Werte.
// Die Prüfung (tools/check.mjs), die Schichten, die Ansicht „Regeln“ und Claude lesen von hier.
// Eine Regel ändern = hier ändern (oder in der Ansicht „Regeln“). Danach \`node tools/check.mjs\` laufen lassen.
window.SYSTEM = {
  name: ${q(S.name)},
  version: ${q(S.version)},

  unit: ${S.unit},          // Raster: Kartengröße, Position und Größe jeder Fläche sind Vielfache davon
  inset: ${S.inset},        // Innenabstand der Karte; nur Flächen mit data-bleed dürfen näher an den Rand
  radius: ${S.radius},       // Außenradius der Karte
  width: ${S.width},       // Standardbreite
  innerRadii: ${val(S.innerRadii)}, // erlaubte Radien für Flächen und Medien; 'pill' = Pille oder Kreis
  spacing: ${val(S.spacing)}, // Abstände (gap, Innenabstand)

  families: {       // erlaubte Familien und wofür sie da sind
${Object.entries(S.families).map(([k, v]) => `    ${q(k)}: ${q(v)},`).join('\n')}
  },
  typeScale: ${val(S.typeScale)}, // erlaubte Schriftgrößen in px
  lineHeightStep: ${S.lineHeightStep},                           // Zeilenhöhen sind Vielfache davon
  limits: ${inline(S.limits)}, // pro Layout

  areaRoles: ${val(S.areaRoles)},

  // Benannte Textstile. Der Bearbeiten-Modus bietet nur diese an; die Grenzen oben gelten weiter.
  textStyles: [
${S.textStyles.map(t => `    ${inline(t)},`).join('\n')}
  ],

  // Die Regeln. \`checks\` = Kürzel der Prüfungen in measure() (factory/factory.js); leer = nicht gemessen.
  // \`code\` in Backticks wird in der Ansicht als Code gesetzt.
  rules: [
${S.rules.map(r => `    {
      id: ${q(r.id)}, title: ${q(r.title)}, checks: ${val(r.checks)},
      text: ${q(r.text)},
    },`).join('\n')}
  ],
};
`;
}

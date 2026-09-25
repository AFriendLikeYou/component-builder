// Das Regelwerk „ZEIT Design System“ als Daten – die einzige Quelle für seine Regeln und Werte.
// Die Prüfung (tools/check.mjs), die Schichten, die Ansicht „Regeln“ und Claude lesen von hier.
// Ändern hier oder in der Ansicht „Regeln“. Danach `node tools/check.mjs --system zds` laufen lassen.
window.SYSTEM = {
  name: 'ZEIT Design System',
  id: 'zds',
  version: '1',

  unit: 1,          // Raster für Lage und Größe der Flächen (1 = kein Raster)
  gridView: 4,      // Abstand der Linien in der Pixel-Schicht
  inset: 16,        // Innenabstand der Karte; nur Flächen mit data-bleed dürfen näher an den Rand
  radius: 8,       // Außenradius der Karte
  width: 352,       // Standardbreite
  innerRadii: [0, 2, 4, 8, 'pill'], // erlaubte Radien für Flächen und Medien; 'pill' = Pille oder Kreis
  spacing: [4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 56], // Abstände (gap, Innenabstand)
  minTarget: 32,     // Mindestgröße für Bedienelemente in px

  families: {       // erlaubte Familien und wofür sie da sind
    'Tablet Gothic': 'Oberfläche, Fließtext, UI-Überschriften',
    'Zeit Tiemann Schmal': 'Überschriften und Schlagzeilen',
  },
  headline: { family: 'Zeit Tiemann Schmal', min: 18 }, // diese Familie nur für Überschriften ab min px
  typeScale: [12, 14, 16, 18, 20, 22, 24, 26, 30, 32, 34, 36, 42, 46, 54], // erlaubte Schriftgrößen in px
  lineHeightRatios: [1, 1.1, 1.2, 1.5], // Zeilenhöhe = Schriftgröße × einer dieser Faktoren
  limits: { families: 2, sizes: 3, weights: 3 }, // pro Layout

  areaRoles: ['media', 'text', 'control', 'meta'],
  tokenPrefixes: ['--c-', '--z-ds-color-'], // CSS-Variablen, die als Farb-Tokens zählen
  accentFamilies: {  // Akzentfamilien: höchstens eine pro Layout
    'ZEIT-Rot': ['--c-warm', '--c-warm-soft', '--z-ds-color-accent-100', '--z-ds-color-accent-70'],
    'Blau': ['--c-accent', '--c-accent-soft', '--z-ds-color-focus-100'],
    'Gelb': ['--c-highlight', '--z-ds-color-background-warning'],
  },

  // Benannte Textstile. Der Bearbeiten-Modus bietet nur diese an; die Grenzen oben gelten weiter.
  textStyles: [
    { id: 'schlagzeile', name: 'Schlagzeile', family: 'Zeit Tiemann Schmal', size: 30, lh: 33, weight: 400 },
    { id: 'schlagzeile-klein', name: 'Schlagzeile klein', family: 'Zeit Tiemann Schmal', size: 22, lh: 24.2, weight: 400 },
    { id: 'ueberschrift-1', name: 'Überschrift 1', size: 30, lh: 36, weight: 700 },
    { id: 'ueberschrift-2', name: 'Überschrift 2', size: 22, lh: 26.4, weight: 700 },
    { id: 'ueberschrift-3', name: 'Überschrift 3', size: 18, lh: 21.6, weight: 700 },
    { id: 'text-gross', name: 'Text groß', size: 18, lh: 27, weight: 400 },
    { id: 'text', name: 'Text', size: 16, lh: 24, weight: 400 },
    { id: 'text-stark', name: 'Text stark', size: 16, lh: 24, weight: 600 },
    { id: 'text-klein', name: 'Text klein', size: 14, lh: 21, weight: 400 },
    { id: 'text-klein-stark', name: 'Text klein stark', size: 14, lh: 21, weight: 600 },
    { id: 'meta', name: 'Meta', size: 12, lh: 18, weight: 400 },
    { id: 'label', name: 'Label', size: 12, lh: 14.4, weight: 600 },
  ],

  // Die Regeln. `checks` = Kürzel der Messungen in measure() (factory/factory.js); nur diese zählen. Leer = nicht gemessen.
  // `ctl` = Werte, die die Ansicht „Regeln“ zum Einstellen anbietet. `code` in Backticks wird als Code gesetzt.
  // {unit}, {inset}, {limits.sizes} … sind Platzhalter für die Werte oben.
  rules: [
    {
      id: 'Z1', title: 'Abstände aus der ZDS-Skala', checks: ['spacing'], ctl: ['spacing'],
      text: 'Abstände – `gap` sowie `padding` und `margin` der Flächen und ihrer Container – nur aus der Skala {spacing} px (`--z-ds-space-*`). Ein festes Flächenraster wie in der Fabrik gibt es in ZDS nicht.',
    },
    {
      id: 'Z2', title: 'Innenabstand {inset} px', checks: ['inset'], ctl: ['inset'],
      text: 'Jede Fläche hält {inset} px (`--z-ds-space-m`) Abstand zum Kartenrand. Randabfallende Medien mit `data-bleed`.',
    },
    {
      id: 'Z3', title: 'Schrift', checks: ['family', 'families', 'sizes', 'weights', 'scale', 'leading', 'headline'], ctl: ['limits', 'typeScale', 'lineHeightRatios'],
      text: 'Tablet Gothic für Oberfläche, Text und UI-Überschriften, Zeit Tiemann Schmal nur für Überschriften und Schlagzeilen ab {headline.min} px. Größen aus der ZDS-Skala ({typeScale}), Zeilenhöhe = Größe × {lineHeightRatios}. Pro Layout höchstens {limits.sizes} Größen, {limits.weights} Schnitte und {limits.families} Familien.',
    },
    {
      id: 'Z4', title: 'Radien', checks: ['radius'], ctl: ['radius', 'innerRadii'],
      text: 'Die Karte hat {radius} (`--z-ds-border-radius-8`). Flächen und Medien: {innerRadii}.',
    },
    {
      id: 'Z5', title: 'Flächen zuerst', checks: ['areas', 'role'],
      text: 'Jede inhaltliche Gruppe ist eine Fläche `data-area="rolle:name"` mit Rolle `media`, `text`, `control` oder `meta`. Die Kopfzeile heißt `text:kopf`.',
    },
    {
      id: 'Z6', title: 'Kein Überlauf', checks: ['overflow', 'error', 'clip', 'height'],
      text: 'Der Inhalt passt in die feste `height` des Layouts. Kein Text ragt aus der Karte oder wird hart abgeschnitten; bewusst gekürzt wird nur mit `.clip` oder Zeilenbegrenzung.',
    },
    {
      id: 'Z7', title: 'Farbe', checks: ['color', 'accent'],
      text: 'Nur ZDS-Farben (`--z-ds-color-*`, in der Fabrik über `--c-*` übersetzt). Text in #252525, Hierarchie über Helligkeit (100 · 70 · 55 · 40). ZEIT-Rot nur als Akzent; höchstens eine Akzentfamilie pro Layout.',
    },
    {
      id: 'Z8', title: 'Keine dunklen Flächen', checks: ['dark'],
      text: 'Karten stehen hell. Statt schwarzer Bühnen gedeckte, zum Inhalt passende Verläufe.',
    },
    {
      id: 'Z9', title: 'Drei Layouts', checks: [], fig: 'three',
      text: 'Jede Komponente hat drei Layouts, die jeweils etwas anderes zuerst zeigen. `idea` sagt in einem Satz, was zuerst auffällt.',
    },
    {
      id: 'Z10', title: 'Gesperrt bleibt gesperrt', checks: ['lock'],
      text: 'Im Bearbeiten-Modus gesperrte Flächen behalten Lage und Größe (`locks` in `components/<id>.tweaks.js`).',
    },
    {
      id: 'Z11', title: 'Trefferflächen', checks: ['target'], ctl: ['minTarget'],
      text: 'Buttons und andere Bedienelemente sind mindestens {minTarget} × {minTarget} px groß.',
    },
    {
      id: 'Z12', title: 'Einheitlich über alle Komponenten', checks: ['consistency'],
      text: 'Gleiche Rolle, gleiche Gestaltung: Die Kopfzeile (`text:kopf`) nutzt überall denselben Textstil und denselben Abstand zum Inhalt darunter – Maßstab ist die klare Mehrheit.',
    },
  ],
};

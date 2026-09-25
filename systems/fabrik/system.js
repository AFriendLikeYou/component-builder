// Das Regelwerk „Fabrik“ als Daten – die einzige Quelle für seine Regeln und Werte.
// Die Prüfung (tools/check.mjs), die Schichten, die Ansicht „Regeln“ und Claude lesen von hier.
// Ändern hier oder in der Ansicht „Regeln“. Danach `node tools/check.mjs --system fabrik` laufen lassen.
window.SYSTEM = {
  name: 'Fabrik',
  id: 'fabrik',
  version: '1',

  unit: 8,          // Raster für Lage und Größe der Flächen (1 = kein Raster)
  inset: 24,        // Innenabstand der Karte; nur Flächen mit data-bleed dürfen näher an den Rand
  radius: 24,       // Außenradius der Karte
  width: 352,       // Standardbreite
  innerRadii: [0, 8, 16, 'pill'], // erlaubte Radien für Flächen und Medien; 'pill' = Pille oder Kreis
  spacing: [8, 16, 24, 32, 40, 48], // Abstände (gap, Innenabstand)
  minTarget: 32,     // Mindestgröße für Bedienelemente in px

  families: {       // erlaubte Familien und wofür sie da sind
    'Inter': 'Oberfläche',
    'Libre Baskerville': 'Akzent: Zitate, Notizen, große Einzelwerte',
  },
  typeScale: [12, 14, 16, 20, 24, 32, 48, 64], // erlaubte Schriftgrößen in px
  lineHeightStep: 8,                           // Zeilenhöhen sind Vielfache davon
  limits: { families: 2, sizes: 3, weights: 3 }, // pro Layout

  areaRoles: ['media', 'text', 'control', 'meta'],

  // Benannte Textstile. Der Bearbeiten-Modus bietet nur diese an; die Grenzen oben gelten weiter.
  textStyles: [
    { id: 'anzeige', name: 'Anzeige', size: 64, lh: 64, weight: 400 },
    { id: 'wert', name: 'Wert', size: 48, lh: 56, weight: 400 },
    { id: 'titel-gross', name: 'Titel groß', size: 24, lh: 32, weight: 500 },
    { id: 'zeit', name: 'Zahl', size: 20, lh: 24, weight: 400 },
    { id: 'titel', name: 'Titel', size: 16, lh: 24, weight: 500 },
    { id: 'text', name: 'Text', size: 14, lh: 24, weight: 400 },
    { id: 'zeile', name: 'Listenzeile', size: 14, lh: 16, weight: 500 },
    { id: 'detail', name: 'Detail', size: 12, lh: 16, weight: 400 },
    { id: 'detail-stark', name: 'Detail stark', size: 12, lh: 16, weight: 500 },
    { id: 'zitat', name: 'Zitat', family: 'Libre Baskerville', size: 32, lh: 40, weight: 400 },
    { id: 'notiz', name: 'Notiz', family: 'Libre Baskerville', size: 24, lh: 32, weight: 400 },
  ],

  // Die Regeln. `checks` = Kürzel der Messungen in measure() (factory/factory.js); nur diese zählen. Leer = nicht gemessen.
  // `ctl` = Werte, die die Ansicht „Regeln“ zum Einstellen anbietet. `code` in Backticks wird als Code gesetzt.
  // {unit}, {inset}, {limits.sizes} … sind Platzhalter für die Werte oben.
  rules: [
    {
      id: 'R1', title: 'Raster {unit} px', checks: ['grid', 'card'], ctl: ['unit'],
      text: 'Kartengröße sowie Position und Größe jeder Fläche (`data-area`) sind Vielfache von {unit}, gemessen ab der linken oberen Kartenecke.',
    },
    {
      id: 'R2', title: 'Inset {inset} px', checks: ['inset'], ctl: ['inset'],
      text: 'Jede Fläche hält {inset} px Abstand zum Kartenrand. Ausnahme: randabfallende Medien mit `data-bleed`. Dann am Layout `padding: 0` setzen und alles andere selbst um {inset} px einrücken.',
    },
    {
      id: 'R3', title: 'Schrift', checks: ['family', 'families', 'sizes', 'weights', 'scale', 'leading'], ctl: ['limits', 'typeScale', 'lineHeightStep'],
      text: 'Nur Inter (Oberfläche) und Libre Baskerville (Akzent: Notizen, Zitate, große Einzelwerte). Pro Layout höchstens {limits.sizes} Größen, {limits.weights} Schnitte und {limits.families} Familien. Größen nur aus der Skala ({typeScale}), Zeilenhöhen sind Vielfache von {lineHeightStep}: nimm die `.t-*`-Klassen. SVG-Text zählt mit seiner gerenderten Größe.',
    },
    {
      id: 'R4', title: 'Radien', checks: ['radius'], ctl: ['radius', 'innerRadii'],
      text: 'Die Karte hat {radius} (setzt die Fabrik). Flächen und Medien: {innerRadii}.',
    },
    {
      id: 'R5', title: 'Flächen zuerst', checks: ['areas', 'role'],
      text: 'Jede inhaltliche Gruppe ist eine Fläche `data-area="rolle:name"` mit Rolle `media`, `text`, `control` oder `meta`. Flächen dürfen verschachtelt sein. Buttons, Icons, Balken und Punkte müssen nicht im Raster liegen, nur die Flächen um sie herum.',
    },
    {
      id: 'R6', title: 'Kein Überlauf', checks: ['overflow', 'error', 'clip', 'height'],
      text: 'Der Inhalt passt in die feste `height` des Layouts. Kein Text ragt aus der Karte oder wird hart abgeschnitten; bewusst gekürzt wird nur mit `.clip` (Auslassungspunkte) oder Zeilenbegrenzung.',
    },
    {
      id: 'R7', title: 'Farbe', checks: ['color', 'accent'],
      text: 'Nur Tokens aus `systems/fabrik/system.css` (`--c-*`), auch mit Transparenz; Schwarz und Weiß nur transparent für Linien und Schatten. Höchstens eine Akzentfamilie pro Layout (Blau, Warm oder Gelb). Medien und Platzhalter zählen nicht.',
    },
    {
      id: 'R8', title: 'Drei Layouts', checks: [], fig: 'three',
      text: 'Jede Komponente hat drei Layouts, die jeweils etwas anderes zuerst zeigen: Bild, Steuerung, Liste, einzelner Wert. `idea` sagt in einem Satz, was zuerst auffällt.',
    },
    {
      id: 'R9', title: 'Gesperrt bleibt gesperrt', checks: ['lock'],
      text: 'Flächen, die im Bearbeiten-Modus gesperrt wurden, behalten Lage und Größe. Die Sperren stehen in `components/<id>.tweaks.js` unter `locks`.',
    },
    {
      id: 'R10', title: 'Trefferflächen', checks: ['target'], ctl: ['minTarget'],
      text: 'Buttons und andere Bedienelemente sind mindestens {minTarget} × {minTarget} px groß.',
    },
    {
      id: 'R11', title: 'Einheitlich über alle Komponenten', checks: ['consistency'], level: 'soll',
      text: 'Gleiche Rolle, gleiche Gestaltung: Die Kopfzeile (`text:kopf`) nutzt in allen Komponenten denselben Textstil und denselben Abstand zum Inhalt darunter. Maßstab ist, was die klare Mehrheit der Komponenten macht.',
    },
  ],
};

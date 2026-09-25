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
  widths: [320, 352, 432], // Breakpoints: Kartenbreiten, in denen die Layouts geprüft werden

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

  // Bausteine: Bedienelemente und kleine Teile, aus denen die Komponenten gebaut werden (CSS in system.css).
  // match = woran die Prüfung den Baustein erkennt · variants = Zusatzklassen mit Namen · control: false = nicht bedienbar.
  // sample = Beispiel für die Übersicht: {v} = Variantenklassen, {icon:name:größe} = Icon. Fehlt ein Baustein, hier aufnehmen statt nachbauen.
  atoms: [
    { id: 'btn-round', name: 'Runder Knopf', match: '.btn-round', use: 'Eine Aktion mit Icon: abspielen, weiter, merken.', variants: { sm: 'Klein · 32', lg: 'Groß · 48', xl: 'Sehr groß · 64', solid: 'Gefüllt', ghost: 'Ohne Fläche', float: 'Auf Bild' }, sample: '<button class="btn-round {v}" aria-label="Abspielen">{icon:play:20}</button>' },
    { id: 'btn-pill', name: 'Knopf mit Text', match: '.btn-pill', use: 'Eine Aktion mit Wort, optional mit Icon davor.', variants: { lg: 'Groß · 40', solid: 'Gefüllt' }, sample: '<button class="btn-pill t-14 w-500 {v}">{icon:plus:16}Hinzufügen</button>' },
    { id: 'btn-text', name: 'Textknopf', match: '.btn-text', use: 'Leise Aktion am Rand: „Alle anzeigen“, „Mehr“.', variants: {  }, sample: '<button class="btn-text t-14 w-500 {v}">Alle anzeigen{icon:arrow-right:16}</button>' },
    { id: 'toggle', name: 'Umschalter', match: '.toggle', use: 'An oder aus in einer Auswahl, etwa Themen oder Filter.', variants: { 'is-on': 'An', lg: 'Groß · 40' }, sample: '<button class="toggle t-14 {v}" aria-pressed="false">{icon:plus:16}Klima</button>' },
    { id: 'check', name: 'Abhaken', match: '.check', use: 'Einträge einer Liste erledigen; das Häkchen erscheint nur mit is-done.', variants: { 'is-done': 'Erledigt' }, sample: '<button class="check {v}" role="checkbox" aria-checked="false"><span class="check-box">{icon:check:14}</span><span class="t-14 check-label">Text bis 16 Uhr abgeben</span></button>' },
    { id: 'chip', name: 'Chip', match: '.chip', control: false, use: 'Status, Menge oder Hinweis – nicht klickbar.', variants: { accent: 'Akzent', mark: 'Markiert' }, sample: '<span class="chip t-12 {v}">3 neu</span>' },
    { id: 'progress', name: 'Fortschritt', match: '.progress', control: false, use: 'Wie weit etwas ist: Wiedergabe, Aufgaben, Download. Wert als --p (0 bis 1).', variants: { accent: 'Akzent', 'on-media': 'Auf Bild' }, sample: '<div class="progress {v}" style="--p: .38; width: 160px"><i></i></div>' },
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
    {
      id: 'R12', title: 'Bausteine statt Eigenbau', checks: ['atoms'], level: 'soll', fig: 'atoms',
      text: 'Buttons, Umschalter, Abhaken, Chips und Fortschrittsbalken kommen aus den Bausteinen dieses Regelwerks (`atoms` in `system.js`, CSS in `system.css`), Icons nur über `h.icon`. Farbe und Abstand darf eine Komponente anpassen, Form und Höhe nicht. Fehlt ein Baustein, wird er dort aufgenommen statt in der Komponente nachgebaut.',
    },
  ],
};

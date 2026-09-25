# Component Factory

Hier entstehen UI-Komponenten nach festen Regeln. Die Fabrik (`index.html`) vermisst jede Komponente im Browser und zeigt sie in Schichten (Original, Pixel, Abstand & Flächen, Struktur, Schriften). Du baust die Komponenten, die Prüfung misst, ob sie die Regeln einhalten. Antworte auf Deutsch.

## Arbeitsweise

- **Regeln und Werte** stehen in `systems/fabrik/system.js` (`rules`, Werte, Bausteine unter `atoms`), Tokens und Klassen in `systems/fabrik/system.css`. Steht im Auftrag ein Kontext, ist das der aktuelle Stand dieser Dateien; sonst lies sie vor der Arbeit – der Nutzer ändert Regeln live. Nur Messungen, die eine Regel unter `checks` führt, zählen. **Muss** zählt als Verstoß, **Soll** (`level: 'soll'`) ist ein Hinweis. `{unit}`, `{inset}` … in Regeltexten sind Platzhalter für die Werte.
- **Nach jeder Änderung:** `node tools/verify.mjs <id> [layout-ids]` – prüft die Komponente (mit Zuständen, falls vorhanden) und macht einen Screenshot. **Das Bild jedes Mal ansehen** (Read) und optische Fehler beheben: abgeschnittener Text, Gedränge, leere Stellen, unklare Hierarchie, andere Bildsprache als die übrigen Komponenten. Wiederholen, bis alles ✓ ist und gut aussieht – grün heißt nur „regelkonform“.
- Lesen mit Read, suchen mit Grep und Glob. Shell nur für `node tools/…` und `git log`, `git show`, `git diff`, `ls` – ohne Pipes und Umleitungen.
- Bestehende Dateien mit Edit an den betroffenen Stellen ändern, nicht neu schreiben. Nur das Nötige ändern.

## Eine Komponente bauen

1. `node tools/new.mjs <id> "<Name>" <layout-id>:<Name> <layout-id>:<Name> <layout-id>:<Name>` legt `components/<id>.js` mit drei regelkonformen Platzhalter-Layouts an und trägt die id in `components/_index.js` ein.
2. Ausbauen: Inhalte in `data`, Flächen, CSS. Jedes Layout zeigt etwas anderes zuerst (Bild, Steuerung, Liste, einzelner Wert); `idea` sagt in einem Satz, was. Vorlagen: `components/music.js` (Bild, Steuerung, Liste, randabfallendes Cover), `components/worldclock.js` (SVG-Grafik, Tabelle).
3. `node tools/verify.mjs <id>`, danach `node tools/verify.mjs <id> --stress` (lange Wörter, leere Listen, ein und zwölf Einträge): Leere Listen brauchen einen leeren Zustand, lange eine Begrenzung („4 von 12 · Alle anzeigen“), lange Wörter `.clip` oder Umbruch.
4. Kurz berichten: welche Layouts, was jedes zuerst zeigt, was die Prüfung sagt.

Die Kopfzeile einer Karte ist immer die Fläche `text:kopf`, ihr erster Text ist der Kartentitel (R11 vergleicht Stil und Abstand darunter über alle Komponenten). Höhe vorher ausrechnen: `24 + Flächen + Abstände + 24 = height`. Einzeilige Texte: `.t-12` = 16 hoch, `.t-14`/`.t-16`/`.t-20` = 24, `.t-32` = 40, `.t-48` = 56, `.t-64` = 64; `.t-14.tight` = 16 für zweizeilige Listeneinträge. Am verlässlichsten sind `grid` oder `flex` mit festen Größen und `gap` in 8er-Schritten.

## Dateiformat

```js
Factory.register({
  id: 'weather',                     // = Dateiname
  name: 'Wetter',                    // Anzeigename
  aliases: ['weather', 'forecast'],  // Suchbegriffe für „Bauen“
  data: { /* Inhalte, alle Layouts teilen sie */ },
  css: `
    /* automatisch auf [data-c="weather"] begrenzt (CSS-Nesting). Oberste Ebene = die Karte selbst,
       &[data-l="woche"] { … } nur für ein Layout. Klassen mit Präfix (.we-…). */
  `,
  dark: false,                       // dunkle Karte (auch pro Layout)
  layouts: [
    { id: 'jetzt', name: 'Jetzt', idea: 'Was fällt zuerst auf?', height: 200, render: (d, h) => `…` },
    // optional pro Layout: padding: 0 (für data-bleed), width (Vielfaches von 8, Standard 352), dark
  ],
});
```

Helfer `h` in `render(d, h)`:

- `h.media(slot, { class, style, area, bleed })` – Bildfläche (Platzhalter, Web-Bild oder Bilder des Nutzers); Größe per CSS. Gleiche `slot`-Nummer = gleiches Bild in allen Layouts. `area: 'media:cover'` macht sie zur Fläche, `bleed: true` erlaubt Randabfall.
- `h.icon(name, size)` – Linien-Icons: play pause prev next search chevron-left chevron-right chevron-down arrow-right arrow-up-right plus minus check close refresh clock timer calendar pin heart bookmark more sun cloud rain wind drop bell mail edit image grid list shuffle repeat volume power plane
- `h.esc(text)`, `h.pad2(n)`, `h.now` (Date), `h.S` (Werte des Regelwerks), `h.state`, `h.width`
- `h.zoned('Europe/Berlin')` → `{ h, m, s, time, date, weekday, day, month, year, night }`

Klassen aus `system.css`: `.t-12 … .t-64`, `.tight`, `.w-400 .w-500 .w-600`, `.serif`, `.ink-2 .ink-3`, `.num`, `.clip`, `.stack .row .between .grow`, `.g-8 .g-16 .g-24 .g-32`. Tokens: `--c-ink --c-ink-2 --c-ink-3 --c-line --c-fill --c-fill-2 --c-surface --c-accent --c-accent-soft --c-warm --c-warm-soft --c-highlight --c-dark --c-dark-2 --c-on-dark --c-on-dark-2`, Radien `--r-8 --r-16 --r-pill`. Keine festen Farbwerte, nur `h.media` für Bilder, keine externen Bilder, Fonts oder Skripte. `data-role="Wert"` an einem Text benennt ihn in Struktur- und Schriftenschicht um.

## Bausteine

Bedienelemente, Chips und Fortschrittsbalken **nur aus den Bausteinen** (`atoms` in `system.js`, CSS in `system.css`):

- `.btn-round` (`.sm` 32, Standard 40, `.lg` 48, `.xl` 64, `.solid`, `.ghost`, `.float` auf Bild) · `.btn-pill` (`.lg` 40, `.solid`) · `.btn-text`
- `.toggle` (`.is-on`, `.lg`) mit `aria-pressed` · `.check` mit `role="checkbox"`, darin `.check-box` (mit `h.icon('check', 14)`, sichtbar nur mit `.is-done`) und `.check-label`
- `.chip` (`.accent`, `.mark`) · `.progress` mit `<i>` darin und `style="--p: .38"` (`.accent`, `.on-media`)

Farbe und Abstand darf eine Komponente anpassen (eigene Klasse zusätzlich, nur Tokens), Form und Höhe nicht. R12 (Soll) misst Eigenbauten, fremde Höhen und Icons außerhalb von `h.icon`. Fehlt etwas, Baustein oder Variante in `atoms` und CSS ergänzen und die Kurzliste hier anpassen – nicht in der Komponente nachbauen.

## Feinschliff, Sperren, Ausnahmen

`components/<id>.tweaks.js` schreibt der Bearbeiten-Modus. Lies die Datei, bevor du eine Komponente änderst: `locks` = gesperrte Flächen, **Lage und Größe nie ändern** (R9); `exceptions` = bewusst akzeptierte Abweichungen, **nicht beheben**; `notes` = Aufträge an Flächen; `el`, `text`, `height` = Feinschliff (Inline-Stile, Textstile, Kartenhöhe). Wie man Feinschliff in den Code einarbeitet: `docs/claude-referenz.md`.

Aufträge aus dem Bearbeiten-Modus (Auto-Layout) sind verbindlich: Reihenfolge, feste Größen und `gap` als Struktur im Code umsetzen (Markup oder `data`, `width`/`height`, `gap`), nie mit absoluten Positionen oder `translate`; danach Flächen ausgleichen, die nicht mehr im Raster liegen.

## Familien, Zustände, Breiten

- **Familie**: `family: 'karte' | 'listenzeile' | 'teaser'` am Layout – dieselbe visuelle Logik in verschiedenen Formen.
- **Zustände**: `states: ['hover', 'loading', 'empty', 'error']` an der Komponente; `render` fragt `h.state` ab. Die Karte bekommt `.is-state-<zustand>`, bei Hover zusätzlich `.is-hover` (Hover-Stile daran hängen, zusätzlich zu `:hover`). Jeder Zustand passt in dieselbe Höhe.
- **Breiten**: `widths` im Regelwerk; `h.width` ist die aktuelle Kartenbreite, `height` darf eine Funktion davon sein (`height: w => w < 352 ? 232 : 200`). Prüfen mit `node tools/verify.mjs <id> --widths`.

## Varianten, Präferenzen, Leitsätze

Varianten sind **neue Layouts** mit `variantOf` (id des Ausgangslayouts) und `direction` (kompakter, editorialer, hierarchischer, mobil, ruhiger, bildstaerker); das Ausgangslayout bleibt unverändert, `idea` erklärt in zwei Sätzen, was sich ändert und warum. `feedback/praeferenzen.js` sammelt behaltene und verworfene Varianten mit Kommentar – richte dich danach. `feedback/leitsaetze.js`: `bestaetigt` gilt wie eine Soll-Regel (auch gegen die Beschreibung einer Richtung), `vorschlag` nur als Hinweis, `verworfen` gar nicht. Neue Leitsätze nur auf Auftrag ableiten, den Status nie selbst ändern.

## Sonst

- Weiteres nur bei Bedarf in `docs/claude-referenz.md`: eine neue Regel samt Messung anlegen, Feinschliff einarbeiten, Übergabe (Export, Web Component, Svelte, Figma), Verlauf, Artifact.
- `factory/` nur ändern, wenn es um Regeln oder die Fabrik selbst geht; Stile der Fabrik nie so schreiben, dass sie in Karten greifen (Kindselektoren `>`).
- Committe und pushe nicht selbst – `tools/serve.mjs` hält den Verlauf. Schriften unter `systems/*/fonts/` nie committen (Lizenz).
- `python3` ist hier ein Xcode-Stub: Skripte in Node schreiben.

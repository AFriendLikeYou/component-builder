# Component Factory

Hier entstehen UI-Komponenten nach festen Regeln. Die Fabrik (`index.html`) vermisst jede Komponente im Browser und zeigt sie in fünf Schichten: Original, Pixel, Abstand & Flächen, Struktur, Schriften. Du baust die Komponenten; `tools/check.mjs` misst, ob sie die Regeln einhalten. Antworte auf Deutsch.

## Regeln

Es gibt mehrere **Regelwerke** in `systems/<id>/`: `fabrik` (8-px-Raster, Inter + Baskerville) und `zds` (ZEIT Design System: Tablet Gothic + Zeit Tiemann Schmal, ZDS-Tokens aus `@zeitonline/design-system`, Abstandsskala statt Raster). Welches aktiv ist, steht in der Anfrage; ohne Angabe gilt `fabrik`.

**Lies vor jeder Arbeit `systems/<id>/system.js` des aktiven Regelwerks** und die zugehörige `system.css`. Dort stehen alle Regeln (`rules`) und Werte. Nur Messungen, die eine Regel unter `checks` führt, zählen. Die Fabrik zeigt dieselben Regeln in der Ansicht „Regeln“; `node tools/check.mjs --system <id>` misst sie.

Komponenten sollen in **beiden** Regelwerken funktionieren: nur `--c-*`-Tokens und `.t-*`-Klassen, keine festen Farbwerte (die übersetzt `systems/zds/system.css` sonst nicht). Wer ausdrücklich für ZDS baut, darf `--z-ds-*` direkt nutzen und nimmt die ZDS-Grade `.t-18`, `.t-22`, `.t-30` usw. Regeln haben eine Stufe: **Muss** (Standard, zählt als Verstoß) oder **Soll** (`level: 'soll'`, nur Hinweis). Die Werte können sich ändern – der Nutzer passt Regeln in der Ansicht „Regeln“ live an. Lies sie deshalb jedes Mal, statt sie anzunehmen. `{unit}`, `{inset}` usw. in Regeltexten sind Platzhalter für die Werte darüber.

## Eine Komponente bauen

1. Datei `components/<id>.js` anlegen. Vorlagen: `components/music.js` (Bild, Steuerung, Liste, randabfallendes Cover) und `components/worldclock.js` (SVG-Grafik, Tabelle).
2. Die id in `components/_index.js` eintragen, falls sie dort noch fehlt.
3. `node tools/check.mjs <id>` so lange laufen lassen und korrigieren, bis alles ✓ ist. Danach `node tools/check.mjs <id> --stress`: lange Wörter, leere Listen, ein und zwölf Einträge. Leere Listen brauchen einen leeren Zustand, lange Listen eine Begrenzung („4 von 12 · Alle anzeigen“), lange Wörter `.clip` oder Umbruch.
4. `node tools/shot.mjs <id> --layouts` und `node tools/shot.mjs <id> <layout-id>` erzeugen PNGs in `shots/`. **Sieh sie dir an** (Read-Tool) und prüfe die Optik: abgeschnittener Text, gedrängte oder leere Stellen, klare Hierarchie, gleiche Bildsprache wie die übrigen Komponenten. Grün heißt nur „regelkonform“, nicht „gut“.
5. Kurz berichten: welche Layouts, was jedes zuerst zeigt, was die Prüfung sagt.

Die Kopfzeile einer Karte ist immer die Fläche `text:kopf`; ihr erster Text ist der Kartentitel. R11 vergleicht Stil und Abstand darunter über alle Komponenten.

Höhe vorher ausrechnen: `24 + Flächen + Abstände + 24 = height`. Beispiele für einzeilige Texte: `.t-12` = 16 hoch, `.t-14`/`.t-16` = 24, `.t-20` = 24, `.t-32` = 40, `.t-48` = 56, `.t-64` = 64. `.t-14.tight` = 16 für zweizeilige Listeneinträge (14 + 12 → 32).
Am verlässlichsten sind `display: grid` oder `flex` mit festen Größen und `gap` in 8er-Schritten.

## Dateiformat

```js
Factory.register({
  id: 'weather',                     // = Dateiname
  name: 'Wetter',                    // Anzeigename
  aliases: ['weather', 'forecast'],  // Suchbegriffe für „Bauen“
  data: { /* Inhalte, alle Layouts teilen sie */ },
  css: `
    /* automatisch auf [data-c="weather"] begrenzt (CSS-Nesting).
       Deklarationen auf oberster Ebene gelten für die Karte selbst,
       &[data-l="woche"] { … } nur für ein Layout. Klassen mit Präfix benennen (.we-…). */
  `,
  dark: false,                       // dunkle Karte (auch pro Layout möglich)
  layouts: [
    { id: 'jetzt', name: 'Jetzt', idea: 'Was fällt zuerst auf?', height: 200, render: (d, h) => `…` },
    // optional pro Layout: padding: 0 (für data-bleed), width (Vielfaches von 8, Standard 352), dark
  ],
});
```

Helfer `h` in `render(d, h)`:

- `h.media(slot, { class, style, area, bleed })` erzeugt eine Bildfläche: Platzhalter, Web-Bild oder die eigenen Bilder des Nutzers. Größe per CSS setzen. Gleiche `slot`-Nummer = gleiches Bild in allen Layouts. `area: 'media:cover'` macht sie direkt zur Fläche, `bleed: true` erlaubt Randabfall.
- `h.icon(name, size)` für Linien-Icons: play pause prev next search chevron-left chevron-right chevron-down arrow-right arrow-up-right plus minus check close refresh clock timer calendar pin heart bookmark more sun cloud rain wind drop bell mail edit image grid list shuffle repeat volume power plane
- `h.esc(text)`, `h.pad2(n)`, `h.now` (Date), `h.S` (Systemwerte)
- `h.zoned('Europe/Berlin')` → `{ h, m, s, time, date, weekday, day, month, year, night }`

Bausteine aus `systems/<id>/system.css`: `.t-12 … .t-64`, `.tight`, `.w-400 .w-500 .w-600`, `.serif`, `.ink-2 .ink-3`, `.num`, `.clip`, `.stack .row .between .grow`, `.g-8 .g-16 .g-24 .g-32`, `.btn-round` (`.sm`, `.solid`), `.btn-pill`, `.chip`. Tokens: `--c-ink --c-ink-2 --c-ink-3 --c-line --c-fill --c-fill-2 --c-surface --c-accent --c-accent-soft --c-warm --c-warm-soft --c-highlight --c-dark --c-dark-2 --c-on-dark --c-on-dark-2`, Radien `--r-8 --r-16 --r-pill`.

Nur `h.media` für Bilder, keine externen Bilder, Fonts oder Skripte. `data-role="Wert"` an einem Textelement benennt es in Struktur- und Schriftenschicht um.

## Wenn etwas auffällt: eine Regel daraus machen

So ist das System entstanden: Etwas wirkt falsch, man findet heraus, warum, und schreibt es als Regel auf. Wenn der Nutzer so etwas sagt („zu viele Grautöne“, „die Abstände wirken unruhig“):

1. Regel in `systems/<id>/system.js` des aktiven Regelwerks unter `rules` ergänzen, Werte daneben eintragen.
2. Wenn messbar: Prüfung in `measure()` in `factory/factory.js` ergänzen (`V('kürzel', 'Meldung')`) und das Kürzel in `checks` der Regel eintragen.
3. `node tools/check.mjs` über alle Komponenten laufen lassen und Verstöße beheben.

## Anfragen aus der Fabrik

Läuft die Seite über `node tools/serve.mjs`, schickt die Eingabezeile in „Bauen“ Anfragen direkt an Claude Code (`tools/claude-bridge.mjs`, `claude -p` in diesem Ordner). Der Bearbeiten-Modus in „Layouts“ arbeitet wie Auto-Layout und schickt Strukturänderungen: neue Reihenfolge in einem Flex-/Grid-Container, feste Breite oder Höhe einer Fläche, neuer `gap`, getauschte Grid-Plätze, Kartenhöhe. Dazu die Lage der Flächen in der Vorschau. Setze das als Struktur im Code um (Reihenfolge in Markup oder `data`, `width`/`height`, `gap`), nicht mit absoluten Positionen oder `translate`, und gleiche Flächen aus, die danach nicht im Raster liegen.

## Feinschliff, Sperren, Notizen

`components/<id>.tweaks.js` (falls vorhanden) schreibt der Bearbeiten-Modus direkt, ohne dich. Lies die Datei, bevor du eine Komponente änderst.

- `el`: Inline-Stile je Fläche (Schlüssel = `data-area`, `^name` = Container dieser Fläche): Größe (Hug/Füllen/Fest), Auto-Layout (Richtung, Verteilung, gap, padding), `order`, Rasterplatz.
- `text`: Textstil (`style` = id aus `textStyles` in `system.js`) oder Textinhalt je Text (`Fläche>Index`).
- `height`: Kartenhöhe des Layouts.
- `locks`: **gesperrte Flächen – Lage und Größe nie ändern** (R9, wird gemessen).
- `notes`: Aufträge des Nutzers an einzelne Flächen.
- `exceptions`: bewusst akzeptierte Abweichungen (Regel, Meldung, Grund, Regelwerk). **Nicht „beheben“** – sie sind eine Entscheidung des Nutzers.

„In den Code einarbeiten“ heißt: `el`, `text`, `height` sauber in `components/<id>.js` übernehmen (CSS in `css`, Reihenfolge im Markup oder in `data`, Texte in `data`), Notizen erledigen, danach in der Datei für dieses Layout nur `locks` und `exceptions` stehen lassen. Das Ergebnis muss genauso aussehen wie vorher mit Feinschliff.

## Familien, Zustände, Breiten

- **Familie**: Layouts tragen optional `family: 'karte' | 'listenzeile' | 'teaser'` – dieselbe visuelle Logik in verschiedenen Formen.
- **Zustände**: `states: ['hover', 'loading', 'empty', 'error']` an der Komponente; `render(d, h)` fragt `h.state` ab. Die Karte bekommt `.is-state-<zustand>`, bei Hover zusätzlich `.is-hover` (Hover-Stile daran hängen, zusätzlich zu `:hover`). Jeder Zustand passt in dieselbe Höhe.
- **Breiten**: `widths` im Regelwerk (Breakpoints). `h.width` liefert die aktuelle Kartenbreite; `height` darf eine Funktion der Breite sein (`height: w => w < 352 ? 232 : 200`).
- Prüfen: `node tools/check.mjs <id> --states --widths --stress --system <id>`.

## Varianten und Präferenzen

Varianten entstehen als **neue Layouts** mit `variantOf` (id des Ausgangslayouts) und `direction` (kompakter, editorialer, hierarchischer, mobil, ruhiger, bildstaerker); das Ausgangslayout bleibt unverändert. `idea` erklärt in zwei Sätzen, was sich ändert und warum. `feedback/praeferenzen.js` sammelt, welche Varianten das Team behalten oder verworfen hat, mit Kommentar – lies die Datei vor jeder neuen Variante und richte dich danach.

## Übergabe (Code und Figma)

- `node tools/export.mjs tokens|html|figma|wc|all [id] --system <id>` schreibt nach `export/<regelwerk>/`: `tokens.json` (W3C Design Tokens) und `tokens.css`, je Komponente eine eigenständige HTML-Seite, `<id>.figma.json` für Figma. `export/` ist nicht im Repository.
- **Web Component** (`node tools/export.mjs wc <id>`): `<cf-<id>>` mit Shadow DOM; enthält den unveränderten Quelltext der Komponente, die Tokens des Regelwerks und den Feinschliff. Attribute `layout`, `state`, `width`; Eigenschaften `data`, `images`.
- **Svelte**-Übergaben schreibst du nach `export/<regelwerk>/<id>/svelte/` (Svelte-5-Komponente mit Runes, Props für Inhalte, `layout` und `state`, scoped Styles, Tokens nur als CSS-Variablen aus `tokens.css`). Die Quelle `components/<id>.js` bleibt unverändert.
- Figma: `tools/figma-builder.js` per `figma_execute` ausführen (legt `globalThis.CF` an), dann `await CF.build(daten)` oder `await CF.buildFromURL(url)`. Ergebnis: Seite „Component Factory“ → Section je Regelwerk → Component Set je Komponente mit den Layouts als Varianten, Auto-Layout, Farben als lokale Variablen „Component Factory · <Regelwerk>“. Vorher Datei mit `figma_navigate` (lock) pinnen, nie in Bibliotheksdateien bauen (ZDS-Icons, ZDS-Dokument).

## Sonst

- Vorschau: `open index.html` oder `node tools/serve.mjs` (http://localhost:4173, lädt bei jeder Änderung neu, verbindet die Eingabezeile mit Claude Code).
- Als Artifact veröffentlichen: `node tools/artifact.mjs` bereitet `dist/` vor und gibt die Dateiliste aus.
- Verlauf: Der Ordner ist ein Git-Repository. `tools/serve.mjs` committet jede Änderung selbst (auch deine) und bietet in der Fabrik „Rückgängig“ und „Hierhin zurück“. Committe und pushe nicht selbst.
- `factory/` nur ändern, wenn es um Regeln oder die Fabrik selbst geht. Stile der Fabrik nie so schreiben, dass sie in Karten greifen (Kindselektoren `>` statt Nachfahren).
- `python3` ist hier ein Xcode-Stub: Skripte in Node schreiben.
- ZEIT-Schriften liegen in `systems/zds/fonts/` und sind absichtlich nicht im Repository (öffentlich auf GitHub). Nie committen.

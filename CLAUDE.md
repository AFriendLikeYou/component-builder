# Component Factory

Hier entstehen UI-Komponenten nach festen Regeln. Die Fabrik (`index.html`) vermisst jede Komponente im Browser und zeigt sie in fünf Schichten: Original, Pixel, Abstand & Flächen, Struktur, Schriften. Du baust die Komponenten; `tools/check.mjs` misst, ob sie die Regeln einhalten. Antworte auf Deutsch.

## Regeln

**Lies vor jeder Arbeit `factory/system.js`.** Dort stehen alle Regeln (`rules`, R1 …) und alle Werte: Raster, Inset, Radien, Schriftskala, Grenzen. Das ist die einzige Quelle; die Fabrik zeigt dieselben Regeln in der Ansicht „Regeln“, und `tools/check.mjs` misst alle Regeln mit `checks`. Die Werte können sich ändern – der Nutzer passt Regeln in der Ansicht „Regeln“ live an. Lies sie deshalb jedes Mal, statt sie anzunehmen. `{unit}`, `{inset}` usw. in Regeltexten sind Platzhalter für die Werte darüber.

## Eine Komponente bauen

1. Datei `components/<id>.js` anlegen. Vorlagen: `components/music.js` (Bild, Steuerung, Liste, randabfallendes Cover) und `components/worldclock.js` (SVG-Grafik, Tabelle).
2. Die id in `components/_index.js` eintragen, falls sie dort noch fehlt.
3. `node tools/check.mjs <id>` so lange laufen lassen und korrigieren, bis alles ✓ ist.
4. `node tools/shot.mjs <id> --layouts` und `node tools/shot.mjs <id> <layout-id>` erzeugen PNGs in `shots/`. **Sieh sie dir an** (Read-Tool) und prüfe die Optik: abgeschnittener Text, gedrängte oder leere Stellen, klare Hierarchie, gleiche Bildsprache wie die übrigen Komponenten. Grün heißt nur „regelkonform“, nicht „gut“.
5. Kurz berichten: welche Layouts, was jedes zuerst zeigt, was die Prüfung sagt.

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

Bausteine aus `factory/system.css`: `.t-12 … .t-64`, `.tight`, `.w-400 .w-500 .w-600`, `.serif`, `.ink-2 .ink-3`, `.num`, `.clip`, `.stack .row .between .grow`, `.g-8 .g-16 .g-24 .g-32`, `.btn-round` (`.sm`, `.solid`), `.btn-pill`, `.chip`. Tokens: `--c-ink --c-ink-2 --c-ink-3 --c-line --c-fill --c-fill-2 --c-surface --c-accent --c-accent-soft --c-warm --c-warm-soft --c-highlight --c-dark --c-dark-2 --c-on-dark --c-on-dark-2`, Radien `--r-8 --r-16 --r-pill`.

Nur `h.media` für Bilder, keine externen Bilder, Fonts oder Skripte. `data-role="Wert"` an einem Textelement benennt es in Struktur- und Schriftenschicht um.

## Wenn etwas auffällt: eine Regel daraus machen

So ist das System entstanden: Etwas wirkt falsch, man findet heraus, warum, und schreibt es als Regel auf. Wenn der Nutzer so etwas sagt („zu viele Grautöne“, „die Abstände wirken unruhig“):

1. Regel in `factory/system.js` unter `rules` ergänzen (R9 …), Werte daneben eintragen.
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

„In den Code einarbeiten“ heißt: `el`, `text`, `height` sauber in `components/<id>.js` übernehmen (CSS in `css`, Reihenfolge im Markup oder in `data`, Texte in `data`), Notizen erledigen, danach in der Datei für dieses Layout nur `locks` stehen lassen. Das Ergebnis muss genauso aussehen wie vorher mit Feinschliff.

## Sonst

- Vorschau: `open index.html` oder `node tools/serve.mjs` (http://localhost:4173, lädt bei jeder Änderung neu, verbindet die Eingabezeile mit Claude Code).
- Als Artifact veröffentlichen: `node tools/artifact.mjs` bereitet `dist/` vor und gibt die Dateiliste aus.
- Verlauf: Der Ordner ist ein Git-Repository. `tools/serve.mjs` committet jede Änderung selbst (auch deine) und bietet in der Fabrik „Rückgängig“ und „Hierhin zurück“. Committe und pushe nicht selbst.
- `factory/` nur ändern, wenn es um Regeln oder die Fabrik selbst geht. Stile der Fabrik nie so schreiben, dass sie in Karten greifen (Kindselektoren `>` statt Nachfahren).
- `python3` ist hier ein Xcode-Stub: Skripte in Node schreiben.

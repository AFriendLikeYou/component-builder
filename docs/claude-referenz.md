# Referenz für Claude (nur bei Bedarf lesen)

`CLAUDE.md` enthält, was für Layouts nötig ist. Hier steht der Rest – lies den Abschnitt, um den es im Auftrag geht.

## Eine Regel aus etwas machen, das auffällt

So ist das System entstanden: Etwas wirkt falsch, man findet heraus, warum, und schreibt es als Regel auf. Wenn der Nutzer so etwas sagt („zu viele Grautöne“, „die Abstände wirken unruhig“):

1. Regel in `systems/<id>/system.js` unter `rules` ergänzen (`id`, `title`, `checks`, optional `level: 'soll'`, `ctl`, `fig`, `text`), Werte daneben eintragen.
2. Wenn messbar: Prüfung in `measure()` in `factory/factory.js` ergänzen (`V('kürzel', 'Meldung')`) und das Kürzel in `checks` der Regel eintragen.
3. `node tools/check.mjs` über alle Komponenten laufen lassen und Verstöße beheben.

Vorhandene Kürzel: `grid card spacing inset height overflow clip error areas role radius family families sizes weights scale leading headline color accent dark target lock consistency atoms`.

## Feinschliff in den Code einarbeiten

`components/<id>.tweaks.js` enthält je Layout:

- `el`: Inline-Stile je Fläche (Schlüssel = `data-area`, `^name` = Container dieser Fläche): Größe (Hug/Füllen/Fest), Auto-Layout (Richtung, Verteilung, gap, padding), `order`, Rasterplatz.
- `text`: Textstil (`style` = id aus `textStyles` in `system.js`) oder Textinhalt je Text (`Fläche>Index`).
- `height`: Kartenhöhe des Layouts.
- `locks`, `notes`, `exceptions` (siehe `CLAUDE.md`).

„In den Code einarbeiten“ heißt: `el`, `text`, `height` sauber in `components/<id>.js` übernehmen (CSS in `css`, Reihenfolge im Markup oder in `data`, Texte in `data`), Notizen erledigen, danach für dieses Layout nur `locks` und `exceptions` in der Datei stehen lassen. Das Ergebnis muss genauso aussehen wie vorher mit Feinschliff.

## Übergabe (Code und Figma)

- `node tools/export.mjs tokens|html|figma|wc|all [id]` schreibt nach `export/<regelwerk>/`: `tokens.json` (W3C Design Tokens) und `tokens.css`, je Komponente eine eigenständige HTML-Seite, `<id>.figma.json` und `_bausteine.figma.json` für Figma. `export/` ist nicht im Repository.
- **Web Component** (`wc`): `<cf-<id>>` mit Shadow DOM; enthält den unveränderten Quelltext der Komponente, die Tokens und den Feinschliff. Attribute `layout`, `state`, `width`; Eigenschaften `data`, `images`.
- **Svelte**: nach `export/<regelwerk>/<id>/svelte/` (Svelte-5-Komponente mit Runes, Props für Inhalte, `layout` und `state`, scoped Styles, Tokens nur als CSS-Variablen aus `tokens.css`). `components/<id>.js` bleibt unverändert.
- **Figma**: `tools/figma-builder.js` per `figma_execute` ausführen (legt `globalThis.CF` an). Zuerst `await CF.buildAtoms(bausteine, { icons })` – Section „Bausteine · <Regelwerk>“ mit einem Component Set je Baustein und eigenem Icon-Satz –, danach je Komponente `await CF.build(daten, { icons })`. Bausteine werden in den Karten Instanzen mit Overrides für Text, Icon, Fläche und Schatten. `icons` = optional Komponenten-Keys einer Icon-Library je Name. Vorher die Datei mit `figma_navigate` (lock) pinnen, nie in Bibliotheksdateien bauen.

## Verlauf, Vorschau, Artifact

- Der Ordner ist ein Git-Repository. `tools/serve.mjs` committet jede Änderung selbst (Claude-Aufträge nur mit den Dateien, die Claude geschrieben hat, und einer Zeile „Wirkung: …“ mit Kennzahlen) und bietet „Rückgängig“ und „Hierhin zurück“.
- Vorschau: `node tools/serve.mjs` (http://localhost:4173, Live-Reload, Eingabezeile an Claude Code) oder `open index.html`.
- Als Artifact veröffentlichen: `node tools/artifact.mjs` bereitet `dist/` vor und gibt die Dateiliste aus.
- Werkzeuge einzeln: `node tools/check.mjs [id] [--states --widths --stress]` (Prüfung), `node tools/shot.mjs <id> [layout] [--layouts] [--jpeg]` (Screenshots in `shots/`).

# Anleitung: Regeln und Bausteine ergänzen

Vor jedem Auftrag bekommt Claude `CLAUDE.md`, das Regelwerk (`systems/fabrik/system.js` und `system.css`), `feedback/praeferenzen.js`, `feedback/leitsaetze.js` und die betroffenen Komponenten mit. Seltener Gebrauchtes (Übergabe, Figma, neue Messungen) steht in `docs/claude-referenz.md`, das Claude nur bei Bedarf liest. Was dort steht, wirkt sofort auf neue Layouts. Das meiste lässt sich in der Fabrik unter **Regeln** ändern; die Dateien musst du nur anfassen, wenn du willst.

## Wo liegt was

| Datei | Was drin steht | Wer ändert es |
| --- | --- | --- |
| `systems/<id>/system.js` | Werte (Raster, Inset, Schriftskala …), Regeln (`rules`), Bausteine (`atoms`) | Ansicht „Regeln“, Claude, von Hand |
| `systems/<id>/system.css` | Tokens, Textklassen, Aussehen der Bausteine | Claude, von Hand |
| `factory/factory.js` | Messungen (`measure()`), Icon-Satz (`ICONS`) | Claude, auf Knopfdruck |
| `CLAUDE.md` | Arbeitsweise für Claude, Kurzliste der Bausteine | Claude, von Hand |
| `feedback/leitsaetze.js` | Leitsätze aus euren Rückmeldungen | Claude leitet ab, ihr bestätigt |
| `components/<id>.js` | die Komponenten selbst | Claude |

Das Regelwerk ist `systems/fabrik/`. Weitere Regelwerke sind möglich (eigener Ordner unter `systems/`, Eintrag in `systems/_systems.js`); dann hat jedes eigene Regeln und Bausteine.

## 1. Neue Regeln für Layouts

### In der Oberfläche

1. **Regeln** öffnen, **Regeln anpassen**, **Neue Regel**.
2. Titel und Text schreiben, Stufe wählen: **Muss** zählt als Verstoß, Claude prüft so lange, bis keiner mehr übrig ist. **Soll** ist nur ein Hinweis.
3. **Übernehmen** schreibt die Regel in `system.js`. Die Fabrik misst sofort alle Layouts neu.
4. Soll die Regel gemessen werden: **Prüfung von Claude bauen lassen**. Claude ergänzt eine Messung in `factory/factory.js` und trägt ihr Kürzel unter `checks` ein.
5. Verstoßen Komponenten dagegen: **Verstöße von Claude beheben lassen**.

### Aufbau eines Eintrags

```js
{
  id: 'R13', title: 'Bild in Listenzeilen links', checks: [], level: 'soll',
  text: 'In Listenzeilen steht das Bild links, Titel und Unterzeile rechts daneben.',
},
```

- `id`: fortlaufend, `R1`, `R2` …
- `title`, `text`: was gilt. `{inset}`, `{unit}`, `{limits.sizes}` usw. setzen die aktuellen Werte ein, `` `code` `` wird als Code gezeigt.
- `checks`: Kürzel der Messungen. Leer heißt: Gestaltungsregel, die Claude befolgt, die aber niemand misst.
- `level: 'soll'`: nur Hinweis; weglassen heißt Muss.
- `ctl` (optional): welche Regler die Ansicht anbietet, z. B. `['inset']`, `['spacing']`, `['minTarget']`.
- `fig` (optional): welche Abbildung die Regel zeigt, z. B. `grid`, `fonts`, `colors`, `targets`, `atoms`.

### Gemessen oder nicht

Zuverlässig eingehalten wird eine Regel erst, wenn sie gemessen wird und Muss ist. Diese Messungen gibt es schon:

| Kürzel | misst |
| --- | --- |
| `grid`, `card` | Flächen und Karte im Raster |
| `spacing` | Abstände aus der Skala |
| `inset` | Abstand zum Kartenrand |
| `height`, `overflow`, `clip`, `error` | feste Höhe, nichts läuft über oder wird abgeschnitten |
| `areas`, `role` | Flächen sind markiert und haben eine erlaubte Rolle |
| `radius` | erlaubte Radien |
| `family`, `families`, `sizes`, `weights`, `scale`, `leading`, `headline` | Schrift: Familien, Anzahl der Größen und Schnitte, Skala, Zeilenhöhen, Überschriftenschrift |
| `color`, `accent`, `dark` | nur Tokens, eine Akzentfarbe, keine dunklen Flächen |
| `target` | Mindestgröße von Bedienelementen |
| `lock` | gesperrte Flächen bleiben, wie sie sind |
| `consistency` | Kopfzeilen gleich über alle Komponenten |
| `atoms` | Bausteine statt Eigenbau |

### Andere Wege zu einer Regel

- In **Bauen** schreiben: „Neue Regel: höchstens zwei Grautöne pro Layout. Prüf alle Komponenten.“
- In **Regeln → Gelernt** einen bestätigten Leitsatz **zur Regel machen**.
- `system.js` von Hand ändern und `node tools/check.mjs --system <id>` laufen lassen.

Nicht in `rules` gehört die Arbeitsweise (drei Layouts, Familien, Zustände). Die steht in `CLAUDE.md`. Weiche Vorlieben entstehen als Leitsätze aus euren Entscheidungen zu Varianten.

## 2. Neue Elemente und Bausteine

Ein Baustein besteht aus zwei Teilen: dem Eintrag unter `atoms` in `system.js` (Name, Varianten, Beispiel) und dem Aussehen in `system.css`. Die Klasse und die Namen der Varianten sind der Vertrag mit den Komponenten; das Aussehen darfst du jederzeit ändern, die Komponenten ziehen mit.

### In der Oberfläche (Regeln → Bausteine)

- **Neuer Baustein**: beschreiben, wofür er ist und welche Varianten er braucht. Claude legt Eintrag und CSS an.
- **Ändern** am Baustein: beschreiben, was anders sein soll.
- **Als Baustein aufnehmen** bei einem Eigenbau: Die Form aus einer Komponente steht danach allen Komponenten zur Verfügung.
- **Auf Baustein umstellen** oder **Alle auf Bausteine umstellen lassen**: Eigenbauten in den Komponenten ersetzen.

**Beispiel:** „Ändern“ am Knopf mit Text, Auftrag „eckig mit 4 px Radius statt Pille“. Claude ändert den Radius von `.btn-pill` in `system.css` und ergänzt die Beschreibung unter `atoms`; alle Komponenten mit diesem Knopf ziehen mit.

### Aufbau eines Eintrags

```js
{ id: 'input', name: 'Eingabefeld', match: '.input', use: 'Suche und kurze Eingaben.',
  variants: { lg: 'Groß · 48' }, sample: '<input class="input {v}" placeholder="Suchen">' },
```

- `id`, `name`: interner und angezeigter Name.
- `match`: woran die Messung den Baustein erkennt, meist die Klasse.
- `use`: wofür er da ist, ein Satz.
- `variants`: Zusatzklassen mit Namen, z. B. `{ sm: 'Klein · 32', solid: 'Gefüllt' }`.
- `sample`: Beispiel für die Übersicht. `{v}` setzt die Variante ein, `{icon:play:20}` ein Icon.
- `control: false`: nicht bedienbar (Chip, Fortschritt). Dann prüft die Messung keine Höhe.

Dazu das Aussehen in `system.css`, Farben nur als Tokens:

```css
.input { height: 40px; padding: 0 12px; border-radius: 4px; background: var(--c-fill); }
.input.lg { height: 48px; }
```

### Was danach von selbst passiert

- Die Übersicht zeigt den Baustein mit allen Varianten und zählt, wo er vorkommt.
- Die Messung lernt die erlaubten Höhen aus dem Beispiel und meldet Nachbauten und fremde Größen (Regel „Bausteine statt Eigenbau“, Soll).
- Claude benutzt ihn, weil es vor jedem Auftrag die Bausteine aus `system.js` liest. Aufträge aus der Oberfläche pflegen auch die Kurzliste in `CLAUDE.md` mit.

### Icons

Die Icons stehen in `ICONS` in `factory/factory.js` (24er-Raster, Strich 1,6), Komponenten nehmen sie über `h.icon(name, größe)`. Ein eigenes Icon in einer Komponente erscheint unter den Eigenbauten; **In den Icon-Satz** nimmt es auf.

### Ganze Komponenten

Karten statt Bausteine entstehen über **Bauen**: „Baue eine Komponente Wetterwarnung mit drei Layouts.“ Claude legt `components/<id>.js` an und prüft sie gegen das aktive Regelwerk.

### Nach Figma

1. `node tools/export.mjs figma <id> --system <regelwerk>` schreibt die Komponente und `_bausteine.figma.json` nach `export/<regelwerk>/`.
2. In Figma zuerst `CF.buildAtoms(bausteine, { icons })`: Die Section „Bausteine · <Regelwerk>“ bekommt ein Component Set je Baustein. Beim erneuten Ausführen werden die Komponenten neu gefüllt, Instanzen in den Karten bleiben verbunden.
3. Danach je Komponente `CF.build(daten, { icons })`: Bausteine werden in den Karten Instanzen mit Overrides für Text, Icon, Fläche und Schatten.

Mit einer Icon-Library in Figma (`icons` = Komponenten-Keys je Name) kommen gleiche Icons von dort, fehlende aus dem eigenen Icon-Satz.

## Prüfen

```sh
node tools/verify.mjs <id> [layout …]    # eine Komponente prüfen und Screenshot (shots/<id>-pruefung.jpg)
node tools/check.mjs                      # alle Komponenten
node tools/check.mjs <id> --states --widths --stress
node tools/new.mjs <id> "<Name>" a:Eins b:Zwei c:Drei   # Gerüst für eine neue Komponente
```

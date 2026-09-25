# Component Factory

Ein Nachbau des Experiments „Building a component factory with AI“: UI-Komponenten entstehen in einem festen System aus 8-px-Raster, 24 px Inset und höchstens drei Schriftgrößen, und die Fabrik zeigt, wie jede aus diesen Regeln aufgebaut ist.

## Starten

Im Finder `Start.command` doppelklicken. Oder im Terminal:

```sh
cd ~/component-factory
npm start                   # → http://localhost:4173
```

Das startet die Seite mit Live-Reload und verbindet die Eingabezeile mit deinem Claude Code. Ohne Server geht auch `open index.html`, dann aber ohne Anfragen an Claude.

## Die vier Ansichten

- **Bauen**: Komponente eintippen. Ein bekannter Name spielt den Aufbau ab: Raster, Flächen, Struktur, fertige Komponente, danach eine Kamerafahrt über die Schichten. Alles andere geht als Anfrage an Claude Code, etwa „Baue eine Komponente Flug mit drei Layouts“ oder „Mach das Kompakt-Layout von Musik luftiger“. Die Arbeitsschritte laufen live im Log mit, auch wenn du zwischendurch die Ansicht wechselst oder die Seite neu lädst; in den anderen Ansichten zeigt eine Pille unten, woran Claude gerade arbeitet (ein Klick führt zurück zum Protokoll). „Endlos“ spielt alle Layouts nacheinander ab, gut für Bildschirmaufnahmen (⌘⇧5).
- **Schichten**: jede Komponente als Reihe aus Original, Pixel, Abstand & Flächen, Struktur und Schriften. Die Schichten erzeugt die Seite aus der gemessenen Komponente, niemand zeichnet sie von Hand.
- **Layouts**: die drei Layouts pro Komponente. **Bearbeiten** öffnet den Feinschliff wie Auto-Layout: Fläche anklicken und rechts unten im Panel Größe (Hug / Füllen / Fest), Richtung, Verteilung, Abstand und Innenabstand einstellen; ziehen sortiert um, pinke Balken ändern den Abstand, Doppelklick ändert Text, Textstile nur aus der Liste (was eine Grenze reißen würde, ist gesperrt). Alles wird sofort in `components/<id>.tweaks.js` gespeichert und mitgeprüft. **Sperren** schützt eine Fläche vor Änderungen (R9), **Notiz** und **Claude fragen** geben Claude Aufträge, **In den Code einarbeiten** lässt Claude den Feinschliff sauber in die Komponente übernehmen.
- **Stresstest** (Knopf im Kopf jeder Komponente in „Layouts“): dieselben Layouts mit langen Wörtern, leeren Listen, einem und zwölf Einträgen – gemessen nach denselben Regeln. Für Claude: `node tools/check.mjs --stress`.
- **Ausbauen** (je Komponente in „Layouts“): **Variante** baut ein neues Layout in eine gewählte Richtung (kompakter, editorialer, stärker hierarchisiert, mobil, ruhiger, bildstärker); du behältst oder verwirfst es mit Kommentar, daraus lernt Claude (`feedback/praeferenzen.js`). **Familie & Zustände** ergänzt Listenzeile und Teaser sowie Hover, Lädt, Leer und Fehler und prüft jeden Zustand. Oben wählst du die **Breite** (320 / 352 / 432 px) und siehst, welche Layouts dort brechen.
- **Übergabe** (je Komponente in „Layouts“): HTML + CSS als eigenständige Seite, Tokens (W3C-JSON und CSS), Web Component `<cf-…>` (derselbe Code wie in der Fabrik, samt Feinschliff und Zuständen), Svelte von Claude, Figma als Component Set mit den Layouts als Varianten. Dateien in `export/<regelwerk>/`.
- **Fabrik**: alle Layouts auf einer Fläche, mit Kamerafahrt. Ziehen verschiebt, ⌘ + Scrollen zoomt.
- **Regeln**: alle Gestaltungsregeln mit Beispielen und wie viele Layouts sie erfüllen, dazu Schriftskala, Textstile, Farben, Abstände, Radien. Jede Regel ist **Muss** (Verstoß) oder **Soll** (Hinweis); einzelne Abweichungen akzeptierst du mit Begründung **als Ausnahme**, direkt in der Befundliste. **Regeln anpassen** macht Werte, Texte und Stufen editierbar: Jede Änderung misst sofort alle Layouts neu und zeigt, was brechen würde. **Übernehmen** speichert in `factory/system.js`, **Verwerfen** stellt den alten Stand her. Für neue, noch nicht gemessene Regeln baut Claude auf Knopfdruck eine Prüfung; Verstöße lässt du von Claude beheben.
  - **Bausteine**: alle Bedienelemente des Regelwerks (runder Knopf, Knopf mit Text, Textknopf, Umschalter, Abhaken, Chip, Fortschritt) mit ihren Varianten, wo sie verwendet werden, und die Icons. Darunter die **Eigenbauten**: was eine Komponente selbst gebaut hat statt einen Baustein zu nehmen. Je Eigenbau **Auf Baustein umstellen** oder **Als Baustein aufnehmen** (dann steht die Form allen Komponenten zur Verfügung).
  - **Wirkung**: ob die Regeln Claude besser machen. Je Auftrag Verstöße im ersten Wurf und am Ende, Prüfläufe, Dauer und Kosten (stehen in der Commit-Nachricht), dazu Handarbeit danach, Zurückgenommenes und behaltene Varianten. Die Kurve markiert, wo Regeln geändert wurden – sinkt sie danach, hat die Änderung geholfen.
  - **Gelernt**: was Claude aus euren Rückmeldungen ableitet. **Leitsätze** mit ihren Belegen – ein Vorschlag gilt erst, wenn du ihn **bestätigst**; bestätigte liest Claude wie Soll-Regeln und du kannst sie **zur Regel machen**. Dazu die Entscheidungen zu Varianten, akzeptierte Ausnahmen und offener Feinschliff. **Leitsätze neu ableiten** lässt Claude alles noch einmal durchgehen.

**Regeln oder Bausteine ergänzen?** Schritt für Schritt in [ANLEITUNG.md](ANLEITUNG.md): wo was liegt, wie neue Regeln und Messungen entstehen, wie Bausteine angelegt oder abgewandelt werden und wie sie nach Figma kommen.

## Regelwerk

Die Fabrik arbeitet mit einem Regelwerk, `systems/fabrik/` (8-px-Raster, Inter und Libre Baskerville). Weitere Regelwerke sind technisch möglich und erscheinen dann oben als Umschalter. Das ZEIT Design System ist in ein eigenes Projekt gewandert; sein letzter Stand hier liegt im Git-Tag `zds-regelwerk`.

## Tempo

- **Tempo** in „Bauen“: *Automatisch* nimmt Opus für neue Komponenten und Sonnet für alles an Bestehendem (Varianten, Änderungen, Aufräumen); *Schnell* immer Sonnet, *Gründlich* immer Opus. Die Wahl gilt für alle Aufträge aus der Fabrik.
- Claude bekommt zu jedem Auftrag das Regelwerk und die betroffenen Komponenten gleich mit (Kontextpaket) und prüft mit einem Befehl (`node tools/verify.mjs <id>`): Prüfung und ein verkleinerter Screenshot, den Claude jedes Mal ansieht.
- **Verstöße beheben** und **Alle auf Bausteine umstellen** laufen als Stapel: ein Auftrag je Komponente, bis zu drei gleichzeitig. Das Protokoll zeigt jeden Auftrag mit seinem Stand.
- Wie sich das auswirkt, zeigt „Regeln“ → Wirkung.

## Verlauf

Jede Änderung wird automatisch gespeichert, egal ob sie von dir, vom Feinschliff oder von Claude kommt. Der Ordner ist dafür ein Git-Repository. Oben rechts unter **Verlauf** siehst du alle Änderungen. **Rückgängig** oder ⌘Z nimmt die letzte zurück, **Hierhin zurück** stellt einen früheren Stand komplett wieder her. Auch das Zurücknehmen lässt sich wieder zurücknehmen. **Vergleichen** zeigt vorher und nachher nebeneinander, markiert die geänderten Layouts und scrollt dorthin – nach einer Claude-Änderung auch direkt über „Vorher / Nachher“.

Der Stand liegt auf GitHub: https://github.com/AFriendLikeYou/component-builder (`git push` im Ordner lädt neue Änderungen hoch).

## Eigene Bilder

Bilder oder Videos ins Fenster ziehen. Sie füllen sofort alle Medienflächen, bis die Seite neu geladen wird. Dauerhaft geht es so: Dateien in `media/` legen und oben rechts „Bilder: Ordner“ wählen (mit dem Server automatisch, sonst vorher `node tools/media.mjs`).

## Mit Claude Code weiterarbeiten

Im Terminal `cd ~/component-factory && claude`. Die Regeln stehen in `CLAUDE.md`, Claude liest sie automatisch. Beispiele:

- „Baue eine Komponente ›Aktie‹ mit drei Layouts.“
- „Neue Regel: Sekundärtext nur in einem Grauton. Prüf alle Komponenten.“
- „Stell das Raster auf 4 px um und zeig mir, was bricht.“

Prüfen und ansehen: `npm run check` misst alle Regeln, `node tools/shot.mjs <id>` legt Screenshots in `shots/`. Beenden: im Terminal-Fenster des Servers Strg+C.

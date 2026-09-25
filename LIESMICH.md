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

- **Bauen**: Komponente eintippen. Ein bekannter Name spielt den Aufbau ab: Raster, Flächen, Struktur, fertige Komponente, danach eine Kamerafahrt über die Schichten. Alles andere geht als Anfrage an Claude Code, etwa „Baue eine Komponente Flug mit drei Layouts“ oder „Mach das Kompakt-Layout von Musik luftiger“. Die Arbeitsschritte laufen live im Log mit. „Endlos“ spielt alle Layouts nacheinander ab, gut für Bildschirmaufnahmen (⌘⇧5).
- **Schichten**: jede Komponente als Reihe aus Original, Pixel, Abstand & Flächen, Struktur und Schriften. Die Schichten erzeugt die Seite aus der gemessenen Komponente, niemand zeichnet sie von Hand.
- **Layouts**: die drei Layouts pro Komponente. **Bearbeiten** öffnet den Feinschliff wie Auto-Layout: Fläche anklicken und rechts unten im Panel Größe (Hug / Füllen / Fest), Richtung, Verteilung, Abstand und Innenabstand einstellen; ziehen sortiert um, pinke Balken ändern den Abstand, Doppelklick ändert Text, Textstile nur aus der Liste (was eine Grenze reißen würde, ist gesperrt). Alles wird sofort in `components/<id>.tweaks.js` gespeichert und mitgeprüft. **Sperren** schützt eine Fläche vor Änderungen (R9), **Notiz** und **Claude fragen** geben Claude Aufträge, **In den Code einarbeiten** lässt Claude den Feinschliff sauber in die Komponente übernehmen.
- **Fabrik**: alle Layouts auf einer Fläche, mit Kamerafahrt. Ziehen verschiebt, ⌘ + Scrollen zoomt.
- **Regeln**: alle Gestaltungsregeln mit Beispielen und wie viele Layouts sie erfüllen, dazu Schriftskala, Textstile, Farben, Abstände, Radien. **Regeln anpassen** macht Werte und Texte editierbar: Jede Änderung misst sofort alle Layouts neu und zeigt, was brechen würde. **Übernehmen** speichert in `factory/system.js`, **Verwerfen** stellt den alten Stand her. Für neue, noch nicht gemessene Regeln baut Claude auf Knopfdruck eine Prüfung; Verstöße lässt du von Claude beheben.

## Verlauf

Jede Änderung wird automatisch gespeichert, egal ob sie von dir, vom Feinschliff oder von Claude kommt. Der Ordner ist dafür ein Git-Repository. Oben rechts unter **Verlauf** siehst du alle Änderungen. **Rückgängig** oder ⌘Z nimmt die letzte zurück, **Hierhin zurück** stellt einen früheren Stand komplett wieder her. Auch das Zurücknehmen lässt sich wieder zurücknehmen.

## Eigene Bilder

Bilder oder Videos ins Fenster ziehen. Sie füllen sofort alle Medienflächen, bis die Seite neu geladen wird. Dauerhaft geht es so: Dateien in `media/` legen und oben rechts „Bilder: Ordner“ wählen (mit dem Server automatisch, sonst vorher `node tools/media.mjs`).

## Mit Claude Code weiterarbeiten

Im Terminal `cd ~/component-factory && claude`. Die Regeln stehen in `CLAUDE.md`, Claude liest sie automatisch. Beispiele:

- „Baue eine Komponente ›Aktie‹ mit drei Layouts.“
- „Neue Regel: Sekundärtext nur in einem Grauton. Prüf alle Komponenten.“
- „Stell das Raster auf 4 px um und zeig mir, was bricht.“

Prüfen und ansehen: `npm run check` misst alle Regeln, `node tools/shot.mjs <id>` legt Screenshots in `shots/`. Beenden: im Terminal-Fenster des Servers Strg+C.

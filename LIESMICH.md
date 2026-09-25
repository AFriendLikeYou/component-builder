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
- **Stresstest** (Knopf im Kopf jeder Komponente in „Layouts“): dieselben Layouts mit langen Wörtern, leeren Listen, einem und zwölf Einträgen – gemessen nach denselben Regeln. Für Claude: `node tools/check.mjs --stress`.
- **Ausbauen** (je Komponente in „Layouts“): **Variante** baut ein neues Layout in eine gewählte Richtung (kompakter, editorialer, stärker hierarchisiert, mobil, ruhiger, bildstärker); du behältst oder verwirfst es mit Kommentar, daraus lernt Claude (`feedback/praeferenzen.js`). **Familie & Zustände** ergänzt Listenzeile und Teaser sowie Hover, Lädt, Leer und Fehler und prüft jeden Zustand. Oben wählst du die **Breite** (320 / 352 / 432 px) und siehst, welche Layouts dort brechen.
- **Übergabe** (je Komponente in „Layouts“): HTML + CSS als eigenständige Seite, Tokens (W3C-JSON und CSS), React von Claude, Figma als Component Set mit den Layouts als Varianten. Dateien in `export/<regelwerk>/`.
- **Fabrik**: alle Layouts auf einer Fläche, mit Kamerafahrt. Ziehen verschiebt, ⌘ + Scrollen zoomt.
- **Regeln**: alle Gestaltungsregeln mit Beispielen und wie viele Layouts sie erfüllen, dazu Schriftskala, Textstile, Farben, Abstände, Radien. Jede Regel ist **Muss** (Verstoß) oder **Soll** (Hinweis); einzelne Abweichungen akzeptierst du mit Begründung **als Ausnahme**, direkt in der Befundliste. **Regeln anpassen** macht Werte, Texte und Stufen editierbar: Jede Änderung misst sofort alle Layouts neu und zeigt, was brechen würde. **Übernehmen** speichert in `factory/system.js`, **Verwerfen** stellt den alten Stand her. Für neue, noch nicht gemessene Regeln baut Claude auf Knopfdruck eine Prüfung; Verstöße lässt du von Claude beheben.

## Regelwerke: Fabrik und ZDS

Oben rechts schaltest du zwischen zwei Regelwerken um. **Fabrik** ist das 8-px-System dieses Experiments. **ZDS** ist das ZEIT Design System: Tablet Gothic und Zeit Tiemann Schmal, Farben, Grade, Zeilenhöhen, Radien und Abstände aus dem öffentlichen Paket `@zeitonline/design-system`, dazu die Vorgaben „keine dunklen Flächen“ und „Tiemann nur für Überschriften“. Dieselben Komponenten erscheinen dann in ZDS und werden nach dessen Regeln gemessen. In „Regeln“ vergleicht **Mit ZDS vergleichen** beide Systeme nebeneinander; `node tools/check.mjs --system zds` prüft im Terminal.

Die ZEIT-Schriften liegen nur lokal in `systems/zds/fonts/` (Lizenz, nicht im Repository). Fehlen sie, zeigt ZDS Ersatzschriften.

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

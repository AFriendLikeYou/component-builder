// Leitsätze: was Claude aus den Rückmeldungen des Teams ableitet (Entscheidungen zu Varianten, Ausnahmen, Feinschliff).
// Die Ansicht „Regeln“ → Gelernt zeigt sie; dort werden sie bestätigt, verworfen oder zur Regel gemacht.
// status: vorschlag = gilt noch nicht · bestaetigt = gilt wie eine Soll-Regel · regel = steht jetzt im Regelwerk (regel: <regelwerk>:<id>) · verworfen = nicht wieder vorschlagen
// system: null = alle Regelwerke, sonst die id · belege: <komponente>/<layout> (Entscheidung in praeferenzen.js),
//   ausnahme:<komponente>/<layout>/<prüfung>, feinschliff:<komponente>[/<layout>] · warum: woraus der Leitsatz folgt, ein Halbsatz.
// Nach „window.CF_LEITSAETZE =“ steht gültiges JSON.
window.CF_LEITSAETZE = [
  {
    "id": "L1",
    "titel": "Listentitel ohne Akzentschrift",
    "status": "vorschlag",
    "system": "fabrik",
    "seit": "2026-09-25",
    "text": "Listentitel bleiben in der Oberflächenschrift. Editoriale Varianten gewinnen Ruhe über Größe, Abstand und Bild, nicht über die Akzentschrift.",
    "warum": "Die editoriale Leseliste setzte die Titel in Libre Baskerville und wurde mit „die Schrift ist nicht passend“ verworfen – bisher ein einzelner Beleg.",
    "belege": [
      "reading/liste-editorialer"
    ]
  }
];

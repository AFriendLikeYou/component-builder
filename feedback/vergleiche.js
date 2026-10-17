// Paarvergleiche aus der Varianten-Wand: zwei Pläne blind nebeneinander, gewählt wurde der bessere (oder „gleich“).
// a/b = Plan (id, Name, Richtung, Höhe, Blickfang) · winner: a | b | gleich · comment = warum (optional).
// Die Fabrik errechnet daraus eine Rangfolge (Bradley-Terry); Claude liest es wie praeferenzen.js.
window.CF_VERGLEICHE = [];

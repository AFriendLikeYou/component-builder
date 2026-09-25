// Feinschliff aus dem Bearbeiten-Modus – wird beim Rendern angewendet und von der Prüfung mitgemessen.
// el: Inline-Stile je Fläche (Schlüssel = data-area, ^name = Container dieser Fläche) · text: Textstil/-inhalt (Fläche>Index)
// height: Kartenhöhe · locks: gesperrte Flächen (R9) · notes: Aufträge an Claude. Claude arbeitet el/text/height in den Code ein.
Factory.tweaks("music", {
  "cover": {
    "el": {
      "meta:fortschritt": {
        "cssG": {
          "gridRow": "1",
          "gridColumn": "auto"
        }
      },
      "media:cover": {
        "cssG": {
          "gridRow": "5",
          "gridColumn": "auto"
        }
      }
    }
  }
});

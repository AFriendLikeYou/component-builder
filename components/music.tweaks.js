// Feinschliff aus dem Bearbeiten-Modus – wird beim Rendern angewendet und von der Prüfung mitgemessen.
// el: Inline-Stile je Fläche (Schlüssel = data-area, ^name = Container dieser Fläche) · text: Textstil/-inhalt (Fläche>Index)
// height: Kartenhöhe · locks: gesperrte Flächen (R9) · notes: Aufträge an Claude. Claude arbeitet el/text/height in den Code ein.
Factory.tweaks("music", {
  "warteschlange": {
    "el": {
      "text:titel-1": {
        "cssO": {
          "order": "0"
        }
      },
      "text:titel-3": {
        "cssO": {
          "order": "1"
        }
      },
      "text:titel-2": {
        "cssO": {
          "order": "2"
        }
      },
      "text:titel-4": {
        "cssO": {
          "order": "3"
        }
      }
    }
  }
});

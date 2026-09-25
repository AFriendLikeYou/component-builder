// Feinschliff aus dem Bearbeiten-Modus – wird beim Rendern angewendet und von der Prüfung mitgemessen.
// el: Inline-Stile je Fläche (Schlüssel = data-area, ^name = Container dieser Fläche) · text: Textstil/-inhalt (Fläche>Index)
// height: Kartenhöhe · locks: gesperrte Flächen (R9) · notes: Aufträge an Claude. Claude arbeitet el/text/height in den Code ein.
Factory.tweaks("reading", {
  "liste": {
    "el": {
      "text:artikel-3": {
        "cssW": {
          "alignSelf": "stretch",
          "width": "auto"
        },
        "mode": {
          "w": "fill",
          "h": "fill"
        },
        "cssL": {
          "flexDirection": "row"
        },
        "cssH": {
          "flexGrow": "1",
          "flexShrink": "1",
          "flexBasis": "0%",
          "height": "auto",
          "minHeight": "0"
        }
      }
    }
  },
  "aufmacher": {
    "el": {
      "text:artikel": {
        "cssL": {
          "flexDirection": "column"
        }
      }
    },
    "text": {
      "text:artikel>0": {
        "style": "anzeige",
        "css": {
          "fontFamily": "\"Inter\", sans-serif",
          "fontSize": "64px",
          "lineHeight": "64px",
          "fontWeight": "400",
          "fontStyle": "normal"
        }
      }
    }
  }
});

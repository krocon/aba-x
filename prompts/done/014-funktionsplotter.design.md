# Design 014 – Funktionsplotter

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen

- E1 **Canvas** im LCD-Stil (Tinte auf Grün) an der Stelle des Stacks, Eingabezeile bleibt; Funktionen werden über
  die Strichart unterschieden (LCD ist einfarbig), die gewählte Funktion ist dicker. Gleiche Zeichenroutine für den
  PNG-Export (weißer Hintergrund); SVG aus denselben Polylinien.
- E2 Sampling im Kern (`src/math/graph/sampler.ts`): Grundraster = Pixelbreite, Verfeinerung bis ½ Pixel,
  **Sprung-/Polerkennung per Bisektion** (Änderung konzentriert sich auf ein schrumpfendes Intervall → Lücke),
  undefinierte Stellen → Lücke. Kein senkrechter Strich über Asymptoten oder Sprünge.
- E3 Bedienung: ENTER mit Ausdruck in x fügt hinzu (max. 6, `y = …` erlaubt, fremde Namen → Hinweis), Y= Liste mit
  EDIT/DEL/CLEAR; ZOOM▸ IN/OUT/AUTO/STD/TRIG; Pfeile verschieben, + − zoomen, Maus: Ziehen, Rad, Doppelklick,
  Zwei-Finger-Zoom; TRACE mit ◀▶ und ▲▼ (Funktion wechseln), Koordinaten in der Meldungszeile.
- E4 Funktionen und Fenster im Dokument `graph`.
- Plot bleibt im LCD (kein großes Zusatzfenster) – das Gerät bleibt ein Gerät; Export liefert große Bilder.

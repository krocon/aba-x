# Prompt 034: ABA-T1 – Funktionen-App

> **Abhängigkeiten:** 033 · **Aufwand:** L · **Betrifft:** Kern (Analyse), Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-funktionen-app`. Design-Dokument: `prompts/034-t1-funktionen-app.design.md`.

## 1. Ziel

- **Symb:** zehn Definitionen F1…F9, F0 (`F1(X)=…`) mit Häkchen (anzeigen ja/nein), Farbe je Funktion, Menüleiste
  `Bearb.`, `✓`, `X`, `Anzeigen`, `Ausw.` (Verweise auf andere Fn auflösen); Definitionen über Ableitungen und
  andere Funktionen (`F2(X)=F1'(X)` bzw. `∂`-Vorlage).
- **Plot:** Kurven, Zoom (Menü: Faktoren, Box, X/Y vergrößern/verkleinern, Quadrat, Autoskalieren, Dezimal,
  Ganzzahl, Trigonometrisch, Rückgängig), Pinch/Ziehen, **Trace** (Cursor folgt der Kurve, Koordinaten in der
  Leiste, Wippe hoch/runter wechselt die Kurve), **FKT-Menü:** Nullstelle, Schnittpunkt, Steigung, vorzeichenbehaftete
  Fläche (mit Schattierung), Extremum, Tangente zeichnen, Definition; „Skizzieren“ (Freihand-Kurve → Funktion
  anpassen) optional.
- **Num:** Wertetabelle (X und alle aktivierten Fn), Startwert/Schrittweite (Num-Setup), Zoom in der Tabelle,
  eigene X-Werte („Eigene Tabelle“), Spaltenbreite.
- **Setups:** Plot-Setup (X/Y-Bereich, Ticks, Achsen, Raster, Beschriftung, Cursor, Zeichenmethode: adaptiv/
  Segmente/Punkte), Num-Setup.

## 2. Architektur und Bezug

- ABA-X1 014–016 (Sampler mit Pol-/Sprungerkennung, Analyse: Nullstellen, Extrema, Schnittpunkte, Flächen) –
  `@aba/math/graph` wiederverwenden; Plot-Fläche aus 033.
- Vorbild Kap. 7 (Funktionen-App), Kap. 6 (gemeinsame Operationen in Plot/Num, Zoom-Menü).

## 3. Umsetzung

1. App-Zustand: Definitionen (AST + LaTeX), Farben, Aktiv-Flags, Fenster, Tabelle; App-Variablen (`Xmin` …,
   `F1`…`F0` als Funktionen in Start- und CAS-Ansicht aufrufbar).
2. Analyse-Funktionen aus dem Kern; Ergebnisse als Punkte/Flächen im Plot, Werte in der Leiste, „Kopie“ in die
   Startansicht.
3. Num-Tabelle über die gemeinsame Tabellenkomponente; Neuberechnung im Worker.
4. Geteilter Bildschirm Plot/Num (View-Menü), Plot-Export (PNG/SVG über `FilesApi`).

### Entscheidungsfragen (im Design-Dokument beantworten)

- Rückgriff auf ABA-X1-Analyse 1:1 oder Erweiterung (Tangente, Steigung) im Kern?
- Farbpalette der Kurven (kontrastreich in hell/dunkel, farbenblind-tauglich).

## 4. Erwartete Dateien und Schnittstellen

- `apps/aba-t1/src/app/apps/function/*`; ggf. `packages/math/src/graph/analysis.ts` (Tangente, Steigung)

## 5. Tests und Abnahmekriterien

**Tests**

- Analyse-Referenzfälle (Nullstellen von x²−x−2, Extremum, Schnittpunkt zweier Kurven, Fläche ∫₋₁² …).
- Zoom-Operationen (Viewport rein), Tabellenwerte inkl. Polstellen (Fehler statt Zahl).

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- F1=sin(X), F2=X²−1: Plot, Trace mit Kurvenwechsel, Nullstelle und Schnittpunkt über FKT, Fläche schattiert,
  Tabelle mit Schrittweite 0.5; alles per Touch **und** Tastatur; Zustand nach Neustart.
- `tan(X)` ohne senkrechte Verbindungslinien.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Parametrisch/Polar/Folge (035), implizite Relationen (036).

## 7. Doku

- Hilfe, README/Screenshots (später 048), `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- was aus ABA-X1 wiederverwendet wurde, was neu ist

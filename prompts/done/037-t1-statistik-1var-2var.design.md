# Design 037 – ABA-T1: Statistik 1 Var und 2 Var

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen:
  - E1 Kern `@aba/math/stats` (descriptive, regression, special, distributions, inference, random) – framework-frei, auch
    für ABA-X1 nutzbar; Summen kompensiert (Kahan-Neumaier), Varianz zweipassig
  - E2 **Quartile:** Median der unteren und oberen Hälfte, bei ungeradem n ohne den Median (Tukey/„Methode 1“ wie die
    üblichen Taschenrechner); Nachweis an den Wikipedia-Beispieldaten; n = 1 → Q1 = Med = Q3
  - E3 **Klassen:** Standard Sturges (⌈log₂ n⌉ + 1 Klassen), Breite auf 1-2-5 aufgerundet, Start am Vielfachen der Breite;
    abschaltbar in ⇧Plot (Start, Breite)
  - E4 **Regression:** linear und polynomial per Householder-QR (zentriertes x), transformierbare Modelle (log, exp,
    power, exponent, inverse) als lineare Fits der transformierten Daten (r/R² auf der transformierten Skala wie bei
    Taschenrechnern), logistisch und trigonometrisch per Levenberg-Marquardt; Startwerte: logistisch aus L = 1,05·max y
    und linearisiertem Fit, trigonometrisch sechs Frequenzstarts aus dem Datenabstand, der beste gewinnt; abgelehnt wird
    (`no-convergence`), wenn der Endpunkt nicht stationär ist
  - E5 Häufigkeiten müssen nichtnegative ganze Zahlen sein (Quartile sonst nicht definiert)
  - E6 Diagramme als reine Geometrie (`apps/stats/stats-logic.ts`: Rechtecke, Linien, Punkte, Sektoren, Trace-Punkte),
    Zeichnen im Frontend; Stamm-Blatt als Text
  - E7 Datenspalten D1…D0/C1…C0 in einem eigenen Spalteneditor (`apps/shared/columns-editor.ts`), Austausch mit den
    Listen L0…L9 über „Mehr“ (statt eigener Variablen)
- Weggelassen: benutzerdefinierte Anpassung (eigene Formel), CSV-Import direkt in die Spalten (geht über Listen bzw.
  später die Tabellenkalkulation), NIST-StRD-Datensätze (Referenzen: mpmath, Anscombe)

## Fortschritt

- [x] Kern (267 Specs inkl. 037/038) · [x] Apps 1Var/2Var: Symb (Analysen), Num (Spalten, Sortieren, Mehr, Stats),
      Plot (10 Diagrammtypen, Streudiagramm + Ausgleichskurve, Trace, Auto, Pred Y/X), ⇧Plot · [x] Hilfe DE/EN
- [x] Unit-Specs (Diagramme, Stamm-Blatt, Fit) · [x] E2E (1Var Kennzahlen + Plot, 2Var linear + Vorhersage)

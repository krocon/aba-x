# Design 039 – ABA-T1: Löser-Apps (Lösen, Linearlöser, Finanzen, Dreiecklöser)

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 Mathematik vollständig in `@aba/math` (`numeric/solve-multi.ts`, `numeric/equations.ts`,
  `linalg/linear-system.ts`, `finance/*`, `geometry/triangle.ts`); die Apps verdrahten nur · E2 Lösen meldet ehrlich
  „Null“ (Lösung), „Vorzeichenwechsel“ oder „Extremum“ (beides keine Lösung, der Wert zeigt die nächste Stelle) ·
  E3 Systeme: je Gleichung eine markierte Unbekannte, gedämpftes Newton mit numerischer Jacobi-Matrix; Stillstand ist
  `not-solvable`, nie eine Lösung · E4 Linearlöser über die Ränge von A und [A | b] (RREF): eindeutig / unendlich viele
  (Parameter t1, t2 … mit Nullraumbasis) / keine · E5 Vorzeichen Geldfluss: erhalten positiv, gezahlt negativ ·
  E6 Kalender proleptisch gregorianisch, Jahre 1 … 9999, ISO-Eingabe; Tage actual oder 30/360 US · E7 ein gemeinsames
  Formular `apps/shared/field-form.ts` (Zahl, Text, Auswahl, Ergebniszeile; Menü vom Besitzer) für Lösen-Num,
  Finanzen und Dreiecklöser

## Fortschritt

- [x] Kern: Mehrvariablen-Löser, Gleichungen, lineare Systeme, TVM/Tilgung/Cashflow/Datum/Abschreibung/Anleihe/
  Black-Scholes, Dreiecke (SSS, SWS, WSW, WWS, SSW mit 0/1/2 Lösungen, Konsistenz, rechtwinklig)
- [x] Apps: Lösen (Symb über die generische Kurven-Symb, Art `solve`, E1…E0; Num; Plot), Linearlöser (2…6),
  Finanzen (10 Arbeitsblätter, Tilgungsplan, Grafik), Dreiecklöser (Num, maßstäbliche Skizze)
- [x] Texte und Hilfe DE/EN, Unit-Specs, E2E (Chromium) inkl. axe je Ansicht

## Aufbau

| App              | Ansichten                     | Bedienung                                                                                  |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| Lösen            | Symb, Plot, Num (Start Symb)  | Symb: E1…E0 (Menü `=` beim Bearbeiten). Num: Variablen mit Wert = Startwert; Unbek. markiert, Keine, Lösen. Plot: beide Seiten über der Variablen, Tippen/←→ setzt den Startwert, Variable wechseln, Auto, Zoom |
| Linearlöser      | Num                           | Raster der Koeffizienten + rechte Seite; Ergebnis sofort; 2×2, 3×3, n −, n + (bis 6), Löschen |
| Finanzen         | Symb (Blätter), Plot, Num     | Num: Formular des Blatts; Lösen berechnet das Feld unter dem Cursor; TVM: Tilgung (je Rate/Jahr, Summen); Cashflow: +CF/−CF, Ergebnisse live. Plot: Restschuld + kumulierte Zinsen bzw. Kapitalwertkurve mit IZF |
| Dreiecklöser     | Num, Plot                     | Drei Werte (mind. eine Seite) → Rest kursiv; Entf., Alle lösch., Lsg 1/2 bei SSW; Modus rechtwinklig, Grad/Bogenmaß; Fläche, Umfang. Plot: Dreieck maßstäblich, zweite Lösung gestrichelt |

Zustand je App versioniert (`version: 1`) in der App-Bibliothek; Lösen nutzt `CurveState` mit `values`, `unknowns`,
`selected`. Startwerte der Lösen-Variablen: gespeicherter Wert, sonst Start-Variable gleichen Namens, sonst 0.

## Bewusst ausgelassen

- Toolbox-Funktionen `TvmFV`, `TvmPV` … (der Rechenkern hat sie, der Katalog/Evaluator noch nicht).
- Lösen: kein Plot-Setup (Fenster über Zoom/Auto/Ziehen), keine Übernahme der Werte in die Start-Variablen,
  Variablennamen aus mehreren Buchstaben nur, wenn MathLive sie als Name liefert (getippt wird `PV` zu P·V).
- Finanzen: keine Tilgungsgrafik als Balken, Abschreibung ohne Plan-Tabelle (ein Jahr wählbar), DB ohne
  Wechsel-zu-linear-Schalter, Anleihe nur mit Kupons 1×/2× im Jahr, kein Datumsfeld-Picker (ISO-Text).
- Dreiecklöser: keine Höhen/Inkreis in der Skizze; Winkel in Grad oder Bogenmaß, Neugrad nicht.
- WebKit-E2E und Desktop-Prüfung führt die Haupt-Session beim Zusammenführen aus.

## Review-Schwerpunkte

- Ehrliche Lösen-Meldungen (Nullstelle vs. Vorzeichenwechsel vs. Extremum), Systemlöser bei falscher Anzahl.
- Vorzeichenkonvention und Tilgungsplan (Anfangsmodus), IRR mit mehreren Vorzeichenwechseln.
- SSW-Fall mit zwei Lösungen und Konsistenzprüfung von mehr als drei Werten.

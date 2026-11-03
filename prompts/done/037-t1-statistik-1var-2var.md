# Prompt 037: ABA-T1 – Statistik 1 Var und 2 Var

> **Abhängigkeiten:** 032, 033 · **Aufwand:** L · **Betrifft:** Kern (Statistik, Regression), Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-statistik`. Design-Dokument: `prompts/037-t1-statistik-1var-2var.design.md`.

## 1. Ziel

- **Statistik 1 Var:** Num = Datenspalten D1…D0 (Editor aus 032), Daten generieren/sortieren/importieren;
  Symb = Analysen H1…H5 (Spalte, Häufigkeitsspalte, Diagrammtyp, Farbe); **Statistiken** (n, min, Q1, Median, Q3,
  max, Σx, Σx², x̄, s, σ, serr …); Plot-Typen **Histogramm, Box-Whisker, Normalwahrscheinlichkeit, Linie, Säule,
  Pareto, Kontrolldiagramm, Punkt, Stamm-Blatt, Kreis**; Trace über Klassen/Punkte.
- **Statistik 2 Var:** Spaltenpaare C1…C0, Analysen S1…S5 mit **Anpassungstyp** Linear, Logarithmisch,
  Exponentiell, Potenz, Exponent (b·aˣ), Invers, Logistisch, Quadratisch, Kubisch, Quartisch, Trigonometrisch,
  Benutzerdefiniert; Kennzahlen (r, R², sCov, σCov, ΣXY …); Plot Streudiagramm + Regressionskurve, **Voraussagen**
  (PredY/PredX), Trace auf Punkten und Kurve.

## 2. Architektur und Bezug

- Vorbild Kap. 12, 13; Datenstrukturen und Tabelleneditor aus 032; Plot-Fläche aus 033.
- Kern `@aba/math/stats` (auch für ABA-X1 nutzbar): numerisch stabile Verfahren (Welford, Zwei-Pass),
  Quartil-Definition **dokumentieren** (es gibt mehrere; Vorbild-Verhalten an Referenzdaten nachweisen),
  Regression: lineare über QR/stabile Normalform, nichtlineare (Logistisch, Trigonometrisch) über
  Levenberg-Marquardt mit Startwerten und ehrlicher Fehlermeldung bei Nichtkonvergenz.

## 3. Umsetzung

1. Kern: deskriptive Statistik, Häufigkeiten/Klassen, Regressionsmodelle mit Gütemaßen, Vorhersage.
2. Zwei Apps auf dem Rahmen; Diagramme als reine Geometrie-Erzeugung im Kern/Logik, Zeichnen im Frontend.
3. Datenimport aus Listen/Spreadsheet (später 041) und CSV über `FilesApi`.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Quartil-Methode (Vorbild nachweisen) und Klassenbreiten-Standard.
- Startwertstrategie für Logistisch/Trigonometrisch; wann wird abgelehnt?

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/stats/{descriptive.ts,regression.ts,fit-nonlinear.ts}` + `*.cases.json`
- `apps/aba-t1/src/app/apps/{stats1,stats2}/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Referenzdatensätze (z. B. NIST StRD für lineare/nichtlineare Regression, Anscombe) mit Toleranzen;
  Grenzfälle (n=1, konstante Daten, fehlende Werte, Häufigkeit 0/negativ → Fehler).

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Datensatz eingeben, Box-Whisker und Histogramm, Kennzahlen; 2 Var lineare und exponentielle Anpassung,
  Vorhersage; Touch-Trace und Tastatur.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Inferenz/Verteilungen (038), Spreadsheet (041).

## 7. Doku

- `docs/mathematics/statistics.md` (Definitionen, Verfahren, Quellen), Hilfe, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Review-Schwerpunkte (numerische Stabilität, Regression) für den separaten Agenten

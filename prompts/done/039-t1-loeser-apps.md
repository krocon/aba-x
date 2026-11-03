# Prompt 039: ABA-T1 – Löser-Apps (Lösen, Linearlöser, Finanzen, Dreiecklöser)

> **Abhängigkeiten:** 032, 033 · **Aufwand:** L · **Betrifft:** Kern (Finanzmathematik, Dreiecke), Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-loeser`. Design-Dokument: `prompts/039-t1-loeser-apps.design.md`.

## 1. Ziel

- **Lösen:** Gleichungen E1…E0 mit beliebig vielen Variablen; Num = alle Variablen als Felder, eine markieren →
  **Lösen** (numerisch, mit Startwert); mehrere Gleichungen gleichzeitig (System, Newton); Plot der Gleichung in der
  gesuchten Variablen; Meldungen „Null“, „Vorzeichenwechsel“, „Extremum“, „keine Lösung“ ehrlich unterscheiden.
- **Linearlöser:** 2×2 / 3×3-Systeme (und n×n) als Eingabemaske; eindeutig / unendlich viele / keine Lösung.
- **Finanzen:** **Zeitwert (TVM)** N, I%/Jahr, BW, Zahlung, ZW, Zahlungen/Jahr, Zinsperioden/Jahr, Anfang/Ende,
  Tilgungsplan (Tabelle + Grafik); Zinskonversion (nominal/effektiv), Datumsberechnung (Tage zwischen Daten, 360/365),
  Cashflow (NPV, IRR, MIRR), Abschreibung (linear, degressiv, Summe der Jahresziffern …), Kostendeckung,
  %‑Veränderung, Anleihe, Black-Scholes. Zugehörige Toolbox-Funktionen (`TvmFV`, `TvmPV` …).
- **Dreiecklöser:** Seiten a, b, c und Winkel A, B, C; beliebige drei Größen → Rest; mehrdeutiger Fall (SSW) mit
  beiden Lösungen; „Nicht genügend Daten“; Skizze maßstäblich; rechtwinkliger Modus.

## 2. Architektur und Bezug

- Vorbild Kap. 15, 16, 20, 21. Numerik aus `@aba/math/numeric` (Brent, Newton), lineare Algebra aus 032.
- Finanzmathematik als `@aba/math/finance` (rein, auch für ABA-X1 nutzbar), Dreiecke als `@aba/math/geometry/triangle`.

## 3. Umsetzung

1. Kern: Mehrvariablen-Löser (eine Unbekannte: Brent mit Klammersuche; System: gedämpftes Newton mit Jacobi
   numerisch), Klassifikation der Ergebnisse.
2. Kern: TVM (geschlossene Formeln, I% per Löser), Cashflow (IRR mit mehreren Vorzeichenwechseln → Warnung),
   Tage-/Datumsrechnung, Abschreibungen, Anleihe, Black-Scholes.
3. Kern: Dreiecksauflösung inkl. mehrdeutigem Fall und Konsistenzprüfung.
4. Vier Apps mit Num-Masken als Formular (Wippe/Touch, Felder markieren), Plot wo sinnvoll.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Datumsrechnung: Kalendersystem (proleptisch gregorianisch), Grenzen.
- Vorzeichenkonvention Geldfluss (Vorbild: Zahlungsstrom aus Sicht des Nutzers) – festlegen und dokumentieren.

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/{numeric/solve-multi.ts,finance/*,geometry/triangle.ts}` + Cases
- `apps/aba-t1/src/app/apps/{solve,linear-solver,finance,triangle-solver}/*`

## 5. Tests und Abnahmekriterien

**Tests**

- TVM-Referenzfälle (Kredit, Sparplan, Anfang/Ende), Tilgungsplan-Summen, IRR mit bekannten Werten, Tage
  zwischen Daten inkl. Schaltjahr; Dreiecke: SSS, SWS, WSW, SSW (0/1/2 Lösungen), ungültige Eingaben.
- Lösen: Gleichung ohne Nullstelle → Meldung, nicht „Lösung“.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Hypothek 30 Jahre: Rate berechnen, Tilgungsplan; Dreieck mit SSW zeigt zwei Lösungen; Lösen-App mit drei
  Variablen; Linearlöser 3×3.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Explorer-Apps (040), symbolisches Lösen (029).

## 7. Doku

- `docs/mathematics/finance.md` (Formeln, Konventionen), Hilfe, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Konventionen (Vorzeichen, Tage) und Review-Schwerpunkte

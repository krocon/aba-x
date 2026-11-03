# Prompt 038: ABA-T1 – Inferenz-App und Wahrscheinlichkeitsverteilungen

> **Abhängigkeiten:** 037 · **Aufwand:** M · **Betrifft:** Kern (Verteilungen, Tests), Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-inferenz`. Design-Dokument: `prompts/038-t1-inferenz-verteilungen.design.md`.

## 1. Ziel

- **Verteilungen** (Toolbox → Math → Wahrscheinlichkeit): Dichte, Verteilungsfunktion (kumulativ) und Inverse für
  Normal, t, χ², F, Binomial, Poisson, Geometrisch, Exponential, Gleichverteilung …; Kombinatorik (nCr, nPr, !),
  Zufallszahlen (gleichverteilt, normal, binomial … mit Startwert).
- **Inferenz-App:** Symb = Methode (Hypothesentest / Konfidenzintervall / χ²-Test / Regression) und Typ:
  Z-Test 1/2 Mittelwerte, 1/2 Anteile; T-Test 1/2 Mittelwerte (gepoolt/nicht); Z- und T-Intervalle; χ²-Anpassung
  und Zweiweg-Tabelle; Inferenz für Regression (Steigung, mittlere Antwort, Vorhersageintervall). Num = Eingaben
  (oder **Import** aus Statistik-Apps), Ergebnisse (Teststatistik, p-Wert, kritische Werte, Intervall,
  Entscheidung); Plot = Verteilungskurve mit schattiertem Bereich und Teststatistik.

## 2. Architektur und Bezug

- Vorbild Kap. 14 (Inferenz), Kap. 23 (Math-Menü Wahrscheinlichkeit).
- Kern `@aba/math/stats/distributions` mit genauen Verfahren: regularisierte unvollständige Gamma-/Betafunktion
  (Kettenbrüche), Inverse per gesichertem Newton/Bisektion, `log`-Raum für Extremwerte.

## 3. Umsetzung

1. Sonderfunktionen (lnΓ, unvollständige Γ/B, erf/erfc) mit Genauigkeitsnachweis.
2. Verteilungen + Inverse; Zufallsgeneratoren (reproduzierbar mit Startwert, z. B. xoshiro).
3. Testverfahren als reine Funktionen (Eingaben → Ergebnisobjekt).
4. Inferenz-App mit Import aus 037.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Genauigkeitsziel (z. B. ≥ 10 signifikante Stellen im Kernbereich) und Referenzquelle (R, Boost-Tabellen, NIST).

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/stats/{special.ts,distributions.ts,inference.ts,random.ts}` + Cases
- `apps/aba-t1/src/app/apps/inference/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Referenzwerte (≥ 200 Fälle aus einer unabhängigen Quelle), Ränder (p=0/1, große df, kleine Wahrscheinlichkeiten),
  Inverse-Round-Trip-Property, Testverfahren gegen Lehrbuchbeispiele mit unabhängiger Nachrechnung.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- T-Test mit Daten aus 1 Var importieren, p-Wert und Grafik; `normalcdf`/`invnorm` in der Startansicht.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Weitere Verteilungen über den Vorbild-Umfang hinaus.

## 7. Doku

- `docs/mathematics/distributions.md`, Hilfe, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- gemessene Genauigkeit je Verteilung; Review-Schwerpunkt Sonderfunktionen

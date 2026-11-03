# Design 038 – ABA-T1: Inferenz-App und Wahrscheinlichkeitsverteilungen

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen:
  - E1 **Genauigkeitsziel:** relativer Fehler < 1e-12 im Kernbereich (cdf/pdf/inverse), erf/erfc ~1e-14; Referenz:
    unabhängige Nachrechnung mit mpmath (40–60 Stellen, Binomial exakt als Bruch), dazu Tabellenwerte (Φ(1,96),
    t(10), χ²(5), F(5,10)) und Lehrbuchbeispiele (Mendel, Anscombe)
  - E2 Sonderfunktionen: lnΓ (Lanczos/Stirling mit Fehlerterm), unvollständige Γ/B über Reihen und Kettenbrüche
    (Lentz), Tails getrennt, damit kleine Wahrscheinlichkeiten nicht durch 1 − x verloren gehen; Inverse per
    gesichertem Newton mit Bisektionsrückfall
  - E3 Zufall: xoshiro128** mit SplitMix32-Start (reproduzierbar mit `randseed`)
  - E4 **Katalog-Namen** (eigene, durchgängige Form): `<vert>pdf(x, Parameter)`, `<vert>cdf(x, Parameter)` = P(X ≤ x),
    `inv<vert>(p, Parameter)` für normal, t, chi2, f, exp, uniform, binom, poisson, geom; dazu `invnorm`, `random`,
    `randint`, `randnorm`, `randbin`, `randseed`. Toolbox → Math → Wahrscheinlichkeit, Hilfe DE/EN mit Beispiel
  - E5 Inferenz-App: Methoden als Tabelle (`apps/inference/inference-logic.ts`) – Eingabefelder, Kernaufruf,
    Ergebniszeilen, Plot-Beschreibung; Ergebnisse rechnen beim Tippen mit (kein eigener Rechnen-Schritt);
    Import x̄, s, n aus einer Datenspalte von Statistik 1Var; χ² und Regression lesen Listen L0…L9 bzw. Matrizen M0…M9
  - E6 Anteils-Intervalle als Wald-Intervalle, Welch-Freiheitsgrade ungerundet
- Weggelassen: eigene Verteilungen über den Vorbild-Umfang hinaus; ein Import aus Statistik 2Var (Regression nutzt Listen)

## Fortschritt

- [x] Kern (Sonderfunktionen, Verteilungen, Tests, Zufall; 147 Referenzfälle + Round-Trips) · [x] Katalogfunktionen
      (4 Specs) · [x] Inferenz-App: Symb, Num mit Import, Plot mit schattiertem Bereich · [x] Hilfe DE/EN
- [x] Unit-Specs (T-Test, Z-Intervall, χ²) · [x] E2E (normalcdf in der Startansicht, T-Test mit Import aus 1Var)

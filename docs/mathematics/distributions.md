# Verteilungen und Inferenz (ABA-T1, Prompt 038)

Kern: `packages/math/src/stats/{special,distributions,inference,random,functions}.ts`.

## Funktionen im Katalog

| Verteilung | Dichte / P(X = k) | P(X ≤ x) | Inverse |
|---|---|---|---|
| Normal (μ = 0, σ = 1) | `normalpdf(x, μ, σ)` | `normalcdf(x, μ, σ)` | `invnormal(p, μ, σ)`, `invnorm` |
| Student t | `tpdf(t, ν)` | `tcdf(t, ν)` | `invt(p, ν)` |
| χ² | `chi2pdf(x, ν)` | `chi2cdf(x, ν)` | `invchi2(p, ν)` |
| F | `fpdf(x, d1, d2)` | `fcdf(x, d1, d2)` | `invf(p, d1, d2)` |
| Exponential | `exppdf(x, λ)` | `expcdf(x, λ)` | `invexp(p, λ)` |
| Gleichverteilung | `uniformpdf(x, a, b)` | `uniformcdf(x, a, b)` | `invuniform(p, a, b)` |
| Binomial | `binompdf(k, n, p)` | `binomcdf(k, n, p)` | `invbinom(q, n, p)` |
| Poisson | `poissonpdf(k, λ)` | `poissoncdf(k, λ)` | `invpoisson(q, λ)` |
| Geometrisch (Versuche bis zum 1. Erfolg) | `geompdf(k, p)` | `geomcdf(k, p)` | `invgeom(q, p)` |

Diskrete Inverse: kleinstes k mit P(X ≤ k) ≥ q. Zufall: `random()`, `randint(a, b)`, `randnorm(μ, σ)`,
`randbin(n, p)`, `randseed(s)` (xoshiro128**, reproduzierbar). Listen werden elementweise ausgewertet.

## Verfahren und Genauigkeit

- lnΓ, lnB, erf/erfc; regularisierte unvollständige Gamma-/Betafunktion über Reihe bzw. Kettenbruch (Lentz), beide
  Tails getrennt berechnet; Binomial/Poisson über `bd0`/`stirlerr` (Loader) ohne Auslöschung.
- Inverse: gesichertes Newton-Verfahren mit Bisektionsrückfall auf einem Klammerintervall.
- Gemessen: relativer Fehler < 1e-12 an 147 mpmath-Referenzfällen (40–60 Stellen), erf/erfc ~1e-14; Round-Trips für
  p von 1e-12 bis 1 − 1e-9. Grenzen: extrem große Freiheitsgrade (> 1e6) weniger genau; Quantile unterhalb der kleinsten
  Gleitkommazahl werden 0.

## Tests und Intervalle

Z-Test 1/2 Mittelwerte und Anteile, T-Test 1/2 Mittelwerte (gepoolt oder Welch, df ungerundet), Z-/T-Intervalle, Anteils-
Intervalle (Wald), χ²-Anpassung (erwartete Anzahlen oder Wahrscheinlichkeiten) und Kontingenztafel, Regression (T-Test
der Steigung, Steigungsintervall, mittlere Antwort, Vorhersageintervall). H₀ wird verworfen, wenn P < α.

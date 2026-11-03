# Statistik (ABA-T1, Prompts 037/038)

Kern: `packages/math/src/stats/` (`@aba/math/stats/*`). Alle Funktionen liefern `MathResult`; ungültige Eingaben ergeben
`domain`, nicht konvergierende Verfahren `no-convergence` – nie erfundene Werte.

## Deskriptiv (`descriptive.ts`)

- n, Σx, Σx² mit kompensierter Summation; Mittelwert, Varianz zweipassig (Abweichungen vom Mittelwert).
- s (n − 1) und σ (n); s, s², serr sind für n = 1 nicht definiert (`null`, Anzeige „—“).
- **Quartile:** Q1/Q3 = Median der unteren/oberen Hälfte der sortierten (gewichteten) Daten; bei ungeradem n gehört der
  Median zu keiner Hälfte. Das entspricht der verbreiteten Taschenrechner-Definition („Methode 1“); andere Programme
  (Excel QUARTILE.INC, R type 7) interpolieren und weichen ab.
- Häufigkeiten: nichtnegative ganze Zahlen; 0 lässt einen Wert weg.
- Histogramm: Klassen [a, b), die letzte schließt den Maximalwert ein. Standard nach Sturges mit 1-2-5-Breite.
- Boxplot: Zäune Q1 − 1,5·IQR, Q3 + 1,5·IQR; Whisker bis zum äußersten Wert innerhalb; Ausreißer einzeln.
- Normalwahrscheinlichkeit: sortierte Daten gegen Normal-Scores Φ⁻¹((i − 0,375)/(n + 0,25)) (Blom).

## Regression (`regression.ts`)

| Modell                  | Form                   | Verfahren                                        |
| ----------------------- | ---------------------- | ------------------------------------------------ |
| Linear                  | y = m·x + b            | QR                                               |
| Logarithmisch           | y = m·ln x + b         | QR auf (ln x, y)                                 |
| Exponentiell            | y = b·e^(m·x)          | QR auf (x, ln y)                                 |
| Potenz                  | y = b·x^m              | QR auf (ln x, ln y)                              |
| Exponent                | y = b·m^x              | QR auf (x, ln y)                                 |
| Invers                  | y = m/x + b            | QR auf (1/x, y)                                  |
| Quadratisch … Quartisch | Polynom                | QR, x zentriert                                  |
| Logistisch              | y = L/(1 + a·e^(−b·x)) | Levenberg-Marquardt                              |
| Trigonometrisch         | y = a·sin(b·x + c) + d | Levenberg-Marquardt (Bogenmaß), 6 Frequenzstarts |

r/R² der transformierten Modelle beziehen sich auf die Geradenanpassung der transformierten Daten (Taschenrechner-
Konvention); Polynome, logistisch und trigonometrisch: R² = 1 − SSE/SST auf y. Referenzen: Anscombe I (r = 0,8164),
mpmath-Nachrechnungen.

## Verteilungen und Inferenz (038)

Siehe [`distributions.md`](distributions.md).

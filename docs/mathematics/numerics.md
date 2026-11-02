# Numerische Verfahren

> Stand: Prompt 013 (02.11.2026). Quelle: `src/math/numeric/`, Specs `numeric.spec.ts`.

| Verfahren | Funktion | Ergebnis | Fehlerfälle |
|---|---|---|---|
| Auswertung (double) | `evaluateNumeric(expr, scope)` | Zahl | `division-by-zero`, `domain` (ln 0, √−1, arcsin 2, Überlauf), `unknown-symbol`, `not-evaluable` (Gleichungen, d/dx ohne Stelle), `unsupported` (i, Matrizen) |
| Funktion für Plot/Verfahren | `compile(expr, x)` | `(x) => number`, Fehler → `NaN` (Lücke) | – |
| Bisektion, Newton, Sekante, **Brent** (Standard) | `roots.ts` | Nullstelle + Iterationen | `not-solvable` (kein Vorzeichenwechsel), `no-convergence`, `domain` |
| Alle Nullstellen in [a, b] | `rootsIn(f, a, b)` | Liste; Pole (1/x) werden verworfen, Berührstellen gefunden | – |
| Ableitung (Ridders) | `derivative(f, x)` | Wert + Fehlerschätzung | `domain` bei Knick (|x| in 0) und Polstelle |
| Trapez, Simpson, Gauß–Legendre (n Punkte) | `quadrature.ts` | Zahl | – |
| **Adaptive Gauß–Kronrod 7/15** (Standard) | `integrateAdaptive` | Wert + Fehlerschätzung + Auswertungen | `domain` (Integrand undefiniert, z. B. √x auf [−1, 1]), `no-convergence` (nicht integrierbare Singularität, 1/x auf [−1, 1]) |

- Unendliche Grenzen werden auf ein endliches Intervall transformiert (x = t/(1−t²) bzw. a + t/(1−t)).
- Gradmaß: exakte Werte für Vielfache von 30°/90° (sin 180° = 0, nicht 1.2e−16); tan 90° → `domain`.
- `(−8)^(1/3) = −2` (reelle ungerade Wurzel), `(−2)^0.5` → `domain` (komplexe Zahlen später).

# Eingabesyntax

> Stand: Prompt 003 (02.11.2026). Quelle: `src/math/parser/*`, Fallkataloge `*.cases.json`.

## Zwei Eingabewege, ein AST

| | Text (`parseText`) | LaTeX (`parseLatex`, aus MathLive/Tastenfeld) |
|---|---|---|
| Namen | ganze Bezeichner: `ab`, `x_1`, `Ans` | Buchstaben einzeln: `xy` = x·y; Namen über `\mathrm{Ans}`, Indizes `x_{1}` |
| Funktionen | `sin(x)`, `sin x` | `\sin(x)`, `\sin x`, `\sin 2x` = sin(2x), `\sin^2x` = (sin x)², `\sin^{-1}` = arcsin |
| Operator-Funktionen | `diff(f, x[, n])`, `integrate(f, x[, a, b])`, `sum(f, k, a, b)`, `product(…)`, `limit(f, x, a)` | `\frac{d}{dx}…`, `\frac{d^2}{dx^2}…`, `\int_a^b … \,dx`, `\sum_{k=1}^{n}…`, `\prod`, `\lim_{x\to a}…` |
| Matrizen | `[[1, 2], [3, 4]]` | `\begin{pmatrix}1&2\\3&4\end{pmatrix}` |

## Bindungsstärke (von schwach nach stark)

`= < > <= >= !=` → `+ −` → `× ÷` und implizites Produkt → unäres `−` → `^` (rechtsassoziativ) → `!` `%`

Daraus folgt: `−x² = −(x²)`, `2^−3` erlaubt, `2x² = 2·(x²)`, **`1/2x = (1/2)·x`**, `2^3^2 = 2^(3^2)`.

## Konventionen

- `log(x)` = Zehnerlogarithmus, `log(x, b)` bzw. `\log_b(x)` = Logarithmus zur Basis b, `ln` = natürlich.
- Konstanten: `pi`/`π`, `e`, `i`, `inf`/`∞`.
- `x^{\circ}` (Grad) wird zu `x·π/180`.
- `f(2)` ist ein Aufruf nur für bekannte Funktionen (eingebaut oder vom Nutzer definiert, Prompt 008), sonst `f·2`.
- `\frac{d}{dx}` und `\int … dx` sind Operatoren: eine Variable `d` vor `x` wird in diesem Zusammenhang immer als
  Differential gelesen.
- Σ, lim und d/dx nehmen **einen Term** (bis zum nächsten `+`/`−`): `\sum_{k=1}^{n}k^2+1` = (Σk²) + 1.
- Fehler tragen eine Zeichenspanne (`span`) für die Markierung in der Eingabe; nicht unterstützt sind Mengen
  `\{…\}` (`unsupported`) und unbekannte Befehle (`unknown-function`).

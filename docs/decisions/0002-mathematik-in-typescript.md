# ADR 0002 – Mathematik nur in TypeScript, Kern ohne Framework

- Status: angenommen · Datum: 02.11.2026

## Kontext
Web und Desktop müssen dieselben Ergebnisse liefern; der Kern soll unabhängig von Angular bleiben.

## Entscheidung
Alle Berechnungen laufen in TypeScript unter `src/math/`. Dort sind Importe von `@angular/*`, `@tauri-apps/*`,
`mathlive` und aus `src/app`/`src/testing` per ESLint (`no-restricted-imports`) verboten. Rust rechnet nicht.
Fehler sind Werte (`MathResult<T>`), keine Exceptions über die Kerngrenze.

## Folgen
+ Gleiche Ergebnisse überall, Kern in Node/Worker testbar. − Rechenintensives läuft im WebView-JS (Worker, ADR 0005).

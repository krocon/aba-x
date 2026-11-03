# Design 003 – Expression-AST und Parser

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Marc: „selbständig alle Prompts abarbeiten“)

## Entscheidungen

- **E1 AST:** 13 Knotentypen (`src/math/ast/nodes.ts`), Zahlen als Text wie geschrieben (exakt weiterverarbeitbar),
  keine Spezialknoten für Bruch/Wurzel – `/` und `call('sqrt'|'root')` genügen; Definitionen sind `rel '='` und
  werden erst bei der Auswertung erkannt (008).
- **E2 Ein Pratt-Parser** für beide Eingaben; der LaTeX-Lexer liefert Strukturen fertig als `expr`/`prefix`-Tokens.
- **E3 Implizite Multiplikation:** Text – Bezeichner sind ganze Namen; LaTeX – Buchstaben einzeln (MathLive-Konvention).
  `1/2x = (1/2)x`. Funktionen ohne Klammern: Text eine Potenz-Ebene, LaTeX das implizite Produkt (`\sin 2x`).
- **E4 Funktionskatalog** `src/math/functions.ts` als einzige Quelle (später Positivliste des CAS).
- **E5 Serializer** Text und LaTeX mit minimalen Klammern; Round-Trip-Specs über alle Fälle.
- **E6 Zahlen:** Der AST hält Dezimaltext; exakte Rechnung (BigInt-Brüche) kommt mit 005.
- Tastenfeld: Mengenklammern und `\angle` entfernt (nicht unterstützt), Σ/Π/lim mit vorbelegtem Index (`k=1`, `x\to`).

## Fortschritt

- [x] AST, Builder, `freeSymbols`, `substitute`
- [x] Text- und LaTeX-Parser, Fehlerspannen, Kataloge (≈ 130 Fälle), Round-Trips, Tastenfeld-Vorlagen
- [x] `docs/mathematics/syntax.md`

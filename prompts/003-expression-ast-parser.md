# Prompt 003: Expression-AST, Text- und LaTeX-Parser, Serializer

> **Abhängigkeiten:** 001 · **Aufwand:** L · **Betrifft:** Kern (`src/math`)
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/expression-ast-parser`. Design-Dokument: `prompts/003-expression-ast-parser.design.md`.

## 1. Ziel

Der eigene AST als Herz des Kerns: typisierte Knoten, ein Parser für Texteingabe (`f(x)=x^2-3*x+2`) und für das LaTeX-Subset, das MathLive und unser Tastenfeld erzeugen, sowie Serializer nach Text und LaTeX – mit Fehlerpositionen.

## 2. Architektur und Bezug

- ADR 0002 (Kern framework-frei), ADR 0003 (LaTeX statt ASCII-Math, kein Compute Engine)
- `docs/technical-evaluation.md` §2: Beispiel-LaTeX von MathLive (`\frac`, `\sqrt`, `\int_0^1 x^2\,dx`, `\frac{d}{dx}`, `\sum_{k=1}^{n}`, `\left|…\right|`, `\cdot`, `\operatorname`)
- Tastenfeld-Vorlagen in `src/app/features/calculator/keypad/keypad-model.ts` (müssen alle parsebar sein)
- Master-Prompt §4.2 (Knotentypen), §6.1/§6.3

## 3. Umsetzung

1. AST-Typen in `src/math/ast/` (discriminated union, `readonly`, `structuredClone`-fähig): Zahl (exakt als Ganzzahl/Bruch-Literal + Dezimal), Symbol, Unär, Binär, Funktionsaufruf, Bruch, Potenz, Wurzel, Integral, Ableitung, Summe/Produkt, Grenzwert, Gleichung, Zuweisung/Funktionsdefinition, Matrix/Vektor, Liste.
2. Tokenizer + Pratt-Parser für Text (Operator-Prioritäten, implizite Multiplikation `2x`, `2(x+1)`, `x y`; unäres Minus vor Potenz: `-x^2 = -(x^2)`; Potenz rechtsassoziativ; Fakultät, Prozent).
3. LaTeX-Parser für das MathLive-Subset; unbekannte Befehle → `syntax`/`unknown-function` mit Spanne.
4. Serializer: Text (kanonisch), LaTeX (für `<math-span>`), Roundtrip-Eigenschaften.
5. Funktionskatalog (Name, Stelligkeit, Aliase: `ln`, `log`, `log_b`, `arcsin`/`asin`, …) als einzige Quelle – später auch Positivliste des CAS-Adapters.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Implizite Multiplikation:** Wie wird `xy` gelesen (Produkt oder Variable)? `sin 2x`? Empfehlung mit Begründung und Beispielen aus MathLive-Ausgaben.
- **Zahlen:** eigene BigInt-Rationalzahl im Kern oder Dezimal-Strings bis zum CAS?

## 4. Erwartete Dateien und Schnittstellen

- `src/math/ast/{nodes,builders,equals}.ts`
- `src/math/parser/{tokenizer,text-parser,latex-parser,functions}.ts`
- `src/math/serializer/{text,latex}.ts`
- `src/math/parser/*.cases.json`

## 5. Tests und Abnahmekriterien

**Tests**

- Fallkatalog ≥ 150 Einträge: Prioritäten, Klammern, implizite Multiplikation, Fehlerpositionen
- jede Tastenfeld-Vorlage (mit gefüllten Platzhaltern) parsebar
- echte MathLive-Ausgaben (im Browser gesammelt) als Fixture
- Property: `parse(serialize(ast))` ≡ `ast`

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Kern-Specs laufen ohne DOM; `pnpm lint` bestätigt die Import-Sperre
- im Gerät (Debug-Ausgabe im Display oder Test-Hook): eingegebener Ausdruck → AST → Text erscheint korrekt

## 6. Ausdrücklich nicht Teil dieses Prompts

- Auswertung (005), CAS (009)
- Komplexe Zahlen (Ausbaustufe)

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen
- `docs/mathematics/syntax.md` (Eingabesyntax, Prioritäten, Aliase)

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund
- offene Grammatik-Fragen

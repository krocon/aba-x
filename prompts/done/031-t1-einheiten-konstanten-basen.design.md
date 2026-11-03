# Design 031 – ABA-T1: Einheiten, Konstanten und Ganzzahl-Basen

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 eigenes Einheitenmodul statt math.js-Units (≈ 90 kB weniger, eigene Fehlercodes, Werte an
  einer Stelle geprüft) · E2 Einheiten nur in der Startansicht/RPN (Werte), nicht im CAS · E3 Einheitensymbole sind
  Namen mit führendem `_` (kein neuer AST-Knoten), Basis-Zahlen sind Zahl-Literale `#…` (Auswertung im Werte-
  Auswerter) · E4 Konstanten werden als Wert × Einheit eingefügt (keine neuen Symbole) · E5 BigInt-Werte als
  Dezimal-String im `Value` (JSON-Persistenz) · E6 Wortbreiten 8/16/32/64 im Menü (Kern kann 1–64)

## Bausteine

`units/units.data.ts` (≈ 85 Einheiten, Präfixe, Menü), `units/units.ts`, `units/constants.data.ts`,
`integer/base.ts`, `value/quantities.ts` (Anbindung an `evaluateValue`), Parser (Text: `_name`, `#…`; LaTeX:
`\mathrm{\_name}`, `\#…`, `5_{m}`), Serializer, `format.valueInput`. App: Einstellungen, Units-/Base-Overlay,
Toolbox-Kategorien, Hilfetexte.

## Fortschritt

- [x] Kern: 39 neue Specs (Umrechnungen, Dimensionen, Temperaturen, Konstanten, Basen) · [x] App + E2E

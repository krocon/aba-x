# Design 009 – CAS-Adapter Nerdamer

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen

- E1 `SymbolicEngine` (`src/math/symbolic/engine.ts`) mit `CasValue { expr, approximate, verified }`.
- E2 Brücke `nerdamer-syntax.ts`: Positivliste hin (ln→log, log→log10, root→nthroot, nCr/nPr umgeschrieben),
  Rückweg mit Abbildung (`cbrt`, `fact`, `_n` → Parameter), unausgewertete Operatoren → `not-solvable`,
  unbekannte Funktionen im Ergebnis → `unsupported`.
- E3 **Numerische Stichprobe für jedes Ergebnis** (`verify.ts`): Gleichheit, Ableitung, Lösung einsetzen,
  Grenzwert annähern. Widerspruch → verworfen.
- E4 Bestimmte Integrale: Quadratur entscheidet über Existenz, exaktes F(b)−F(a) nur bei Übereinstimmung.
- E5 Nerdamer läuft nur im Worker-Chunk (141 kB gzip), das Initial-Bundle bleibt unverändert.
- Hinweis CSP: Nerdamer nutzt `new Function` nur in `buildFunction` (von uns nicht verwendet).

## Fortschritt

- [x] Adapter, Prüfungen, Regressionen aus der Bewertung, `docs/mathematics/cas-capabilities.md`

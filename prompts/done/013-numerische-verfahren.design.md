# Design 013 – Numerische Verfahren

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen

- E1 `evaluateNumeric` (double) mit typisierten Fehlern; `compile()` für Plot/Verfahren (Fehler → NaN = Lücke).
- E2 Standard-Nullstellenverfahren **Brent**; Bisektion, Newton, Sekante zusätzlich; `rootsIn` mit Polfilter.
- E3 Ableitung nach Ridders + Knick-Erkennung über einseitige Differenzen (|x| in 0 → `domain`).
- E4 Standard-Quadratur **adaptive Gauß–Kronrod 7/15** (globale Unterteilung), unendliche Grenzen transformiert.
- E5 Gradmaß mit exakten Spezialwinkeln.

## Fortschritt

- [x] Verfahren + Specs (Grenzfälle einzeln), `docs/mathematics/numerics.md`

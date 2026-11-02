# Design 012 – Symbolische Integration

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen
- E1 `CALC▸ INTEG` liefert F(x) + C (C als Symbol, Hinweis „C: integration constant“); keine elementare
  Stammfunktion → verständliche Meldung, bestimmte Integrale bleiben numerisch möglich.
- E2 Bestimmte Integrale über die Vorlage ∫ab (⇧◀7 oder CALC▸ ∫ab): exakt nur, wenn die numerische Quadratur
  übereinstimmt; divergente Integrale und Unstetigkeiten im Intervall → Fehler; sonst numerischer Wert als Näherung
  (Design 009 E4). Unendliche Grenzen über Grenzwerte bzw. Transformation.
- E3 Die Gegenprobe d/dx F = f läuft für jede Stammfunktion (Design 009 E3).

# Design 015 – Nullstellen, Extrema, Schnittpunkte, Tangenten

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen
- E1 ANLYZ▸ `ROOT EXTR ISECT TANG ∫AREA` im sichtbaren x-Bereich, Ergebnis als Marken im Plot und Text in der
  Meldungszeile; BACK entfernt die Marken.
- E2 Numerisch mit Brent (Nullstellen, Vorzeichenwechsel von f′, f − g), Pole werden verworfen (1/x hat keine
  Nullstelle, 1/x² kein Extremum), Berührstellen gefunden; Tangente über Ridders-Ableitung, an Knicken Fehler.
- E3 Schnittpunkte: gewählte Funktion mit der nächsten in der Liste.
- Exakte Werte (z. B. 2√2) zeigt der CAS-Modus mit SOLVE; der Plot bleibt numerisch.

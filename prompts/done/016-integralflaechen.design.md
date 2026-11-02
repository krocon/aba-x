# Design 016 – Integrationsflächen

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen
- E1 ∫AREA: TRACE an die untere Grenze, ∫AREA, an die obere, ∫AREA → Fläche zwischen Kurve und x-Achse;
  oberhalb gefüllt, unterhalb schraffiert (auch einfarbig unterscheidbar).
- E2 Wert, Anteil oberhalb und unterhalb über adaptive Quadratur; Unstetigkeit/Pol im Intervall → Fehlermeldung
  statt Zahl.
- Exakter Wert: über die Vorlage ∫ab im Standard-/CAS-Modus (Design 012).

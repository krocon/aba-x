# Design 011 – Ableitungen und Grenzwerte

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen

- E1 Drei Wege: `CALC▸ DERIV` (Ableitung nach x bzw. der einzigen Variablen), Vorlage d/dx (⇧▶7 oder CALC▸ d/dx)
  mit beliebiger Variable und Ordnung `\frac{d^n}{dx^n}`, partiell `\frac{\partial}{\partial y}`.
- E2 Jeder Ableitungs-/Grenzwert-Knoten in einem Ausdruck wird einzeln über die geprüften Engine-Methoden gerechnet
  (numerische Gegenprobe je Stufe), nicht als Ganzes an Nerdamer gegeben.
- E3 Präfix-Operatoren (d/dx, Σ, lim) nehmen einen Term bis zum nächsten + oder −.
- Grenzwerte: `lim` über die Vorlage; nicht existente Grenzwerte (1/x in 0) werden gemeldet.

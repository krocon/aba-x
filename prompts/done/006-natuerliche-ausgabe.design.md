# Design 006 – Natürliche Ausgabe und Display

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen
- E1 Stack-Browsing wie am Rechner: ▲ (Taste oder ↑) auf leerer Zeile wählt Ebene 1, ▲/▼ bewegen, ENTER holt in die
  Zeile, DEL/⌫ löscht die Ebene, ON/Esc beendet; das Fenster scrollt mit, wenn die Auswahl über Ebene 4 liegt.
- E2 Feste Ebenen (4) – das Display bleibt gleich groß; lange Ergebnisse scrollen waagerecht, hohe schieben obere
  Ebenen aus dem Bild (seit 001).
- E3 Kopieren: ⌘/Strg+C bei leerer Zeile oder Auswahl kopiert den Text (`toText`) der Ebene; Einfügen übernimmt
  MathLive.
- E4 Screenreader: jede Ebene „Level n: <Text>“; die ausgewählte Ebene trägt `aria-current`.
- Lehrbuchform der CAS-Ergebnisse kam schon mit 005 (`prettify`).

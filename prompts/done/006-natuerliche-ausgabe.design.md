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

## Nachtrag 02.11.2026 (Wunsch Marc)

- E5 Jede Ebene zeigt Eingabe (klein, links, nur wenn sie sich vom Ergebnis unterscheidet), exaktes Ergebnis und
  Dezimalwert – auch für Ergebnisse aus dem CAS-Menü (vorher fehlte dort „≈ …“).
- E6 Bearbeiten: Klick auf eine Ebene oder ↑ + ENTER legt ihre Eingabe in die Zeile; ENTER ersetzt die Ebene an
  ihrer Stelle, ESC/ON bricht ab. RECALL (◀⇧ ▲) holt weiterhin das Ergebnis.
- E7 Volle Größe (Wunsch Marc, Einstellung `fullSize`, ⤢ in der Kopfzeile, ⌥F, Menü Ansicht): Gerät füllt das
  Fenster; Hochformat = Display wächst, Tastatur volle Breite; Querformat ab 860 px = Display links, Tastatur rechts;
  so viele Stack-Ebenen, wie hineinpassen (gemessen per ResizeObserver), größere Schrift im Display.

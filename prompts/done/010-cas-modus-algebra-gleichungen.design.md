# Design 010 – CAS-Modus: Algebra und Gleichungen

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen

- E1 Menüs wie am Rechner: Hauptmenü = Moduswahl (STD CAS GRAPH VARS HIST SETUP); im CAS-Modus zeigt das Softmenü
  die CAS-Funktionen `SIMP EXPA FACT SOLVE CALC▸ MODE▸`, `MODE▸` führt zurück zur Moduswahl.
- E2 Operationen wirken auf die Eingabezeile oder – bei leerer Zeile – auf Ebene 1 (Ergebnis ersetzt sie).
- E3 ENTER im CAS-Modus: `x = 5` und `x² = 4` sind Gleichungen, `[a = b, c = d]` ein System – sie kommen
  unverändert auf den Stack; Funktionsdefinitionen `f(x) = …` gelten wie im Standard-Modus.
- E4 SOLVE: Variable ist x, sonst die einzige freie Größe; sonst Hinweis. Ergebnis `x = −2, x = 2` (aufsteigend),
  Hinweise in der Meldungszeile: „n ∈ ℤ“, „numeric approximations“, „not all solutions could be checked“.
  Systeme: alle freien Größen, mehrere Lösungsmengen durch | getrennt.
- E5 Ausgabe in Lehrbuchform: Polynome nach fallendem Grad, Konstanten zuletzt (`prettify`).
- Komplexe Lösungen (x² + 1 = 0 → ±i) zeigt nur der CAS-Modus, als „nicht geprüft“ markiert.

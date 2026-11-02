# Design 008 – Variablen und Funktionen

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen
- E1 `parseLatexStatement`: `a = …` (Zuweisung, Wert wird sofort ausgerechnet) und `f(x, y) = …` (Definition,
  symbolisch, rekursive Aufrufe erlaubt – Tiefe begrenzt). Im CAS-Modus bleibt `x = 5` eine Gleichung (010).
- E2 Namen: Buchstabe + Buchstaben/Ziffern/_, nicht `pi e i inf Ans` und keine eingebauten Funktionen; Groß-/
  Kleinschreibung zählt. Eine Variable ersetzt eine gleichnamige Funktion und umgekehrt.
- E3 Speicherung als Text in den Dokumenten `variables`/`functions` (Schema 1), beim Laden neu geparst; kaputte
  Einträge werden übersprungen und gemeldet, neuere Schemata gelesen, aber nie überschrieben.
- E4 STO: Wert auf Ebene 1, Name in der Zeile, STO. ◀⇧STO = VARS-Menü.
- E5 VARS-Softmenü (F4): Namen (Funktionen mit „()“), NXT blättert, EXIT zurück; Softkey fügt ein,
  ◀⇧ + Softkey speichert Ebene 1 unter dem Namen, ⇧▶ + Softkey löscht.
- Auswertung: Variablen werden vor der Rechnung eingesetzt, Funktionen inline ersetzt (CAS kennt sie nicht).

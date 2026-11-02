# Design 017 – Verlauf, Export/Import

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen
- E1 Verlauf: jede Auswertung (Eingabe → Ergebnis), höchstens 500 Einträge, Favoriten ★ überleben CLEAR und die
  Grenze; Dokument `history` (Schema 1), Speichern entprellt.
- E2 HIST-Ansicht ersetzt im Display den Stack (die Eingabezeile bleibt): ▲▼ wählen, ENTER = Eingabe übernehmen,
  Softkeys `INPUT RESULT ★FAV DEL CLEAR EXIT`, ON/Esc verlässt.
- E3 Export-Bündel `aba-x-backup` (Version 1) mit Variablen, Funktionen, Verlauf, Einstellungen – gleiches Format auf
  Desktop und Web. Import nur nach Bestätigung (Dialog mit Inhalt), gleichnamige Variablen/Funktionen werden
  ersetzt, Verlauf angehängt, neuere Versionen abgelehnt, kaputte Einträge übersprungen und gemeldet.

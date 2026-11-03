# Design 034 – ABA-T1: Funktionen-App

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 Analyse aus `@aba/math/graph/analysis` (ABA-X1 015/016) wiederverwendet, Auswahl „nächstgelegen
  zum Cursor im sichtbaren Bereich“ in `apps/shared/plot-logic.ts` (auch für 035) · E2 Kurvenfarben: 10 Farben,
  hell/dunkel lesbar, Reihenfolge für Farbsehschwäche gewählt · E3 Plot-Optionen im App-Zustand (Version 2, ältere
  Zustände werden zurückgesetzt) · E4 Fläche zweistufig (Start, Enter an der zweiten Grenze) · E5 „Skizzieren“
  (Freihand) nicht umgesetzt (optional im Prompt)

## Fortschritt

- [x] plot-logic (Zoom-Varianten, fcn) + Specs · [x] Plot-Ansicht (Trace, Menüs, Gehe zu, Def., geteilt, PNG)
- [x] Plot-Einstellungen mit Auswahlfeldern (Setup-Formular erweitert) · [x] E2E (X²−4: Tabelle, Fcn → Nullstelle)

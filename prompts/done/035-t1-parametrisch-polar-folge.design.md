# Design 035 – ABA-T1: Parametrisch-, Polar- und Folge-App

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 eine generische „Kurven-App“ (`apps/curve/`) für alle drei Arten: ein Zustand, gemeinsame
  Symb/Plot/Num/Setups, Unterschiede in `KINDS` · E2 Kern: `sampleParametric` (adaptiv in Pixeln, Bruch an Polen),
  `polar()`, `SequenceSystem` (Memo, füllt von unten auf – keine Stack-Tiefe, N ≤ 100 000, Selbstbezug → Fehler),
  `cobwebMap` · E3 Polar im eingestellten Winkelmaß (θ in Grad wird für x/y umgerechnet) · E4 keine Fcn-Analyse in
  diesen Apps (wie das Vorbild), Animation des Spinnennetzes entfällt

## Nebenbefund (behoben)

Das Display fing jeden Zeiger schon beim Drücken (`setPointerCapture`) – Klicks auf Listen, Kacheln und Menüs im
Display kamen dadurch nicht an (Maus und Touch). Jetzt wird erst beim Ziehen/Pinch gefangen.

## Fortschritt

- [x] Kern (6 Specs) · [x] App-Logik (3 Specs), Ansichten, Registrierung · [x] E2E (Parametrisch: Tabelle)

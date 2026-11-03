# Design 030 – ABA-T1: Toolbox, Katalog, Zeichen und Hilfe

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 Toolbox-Modell in der App (`toolbox-model.ts`), Einfügevorlagen aus dem Funktionskatalog
  (`lookupFunction` → LaTeX-Befehl oder `\operatorname`), CAS-Befehle aus `CAS_COMMANDS` – keine zweite Liste von
  Funktionen · E2 Hilfetexte als TypeScript-Daten (EN/DE, eigenes Wording, ~65 Befehle, 5 Ansichten), nicht lazy –
  wenige kB · E3 ein Overlay (`PopupView`) für Toolbox, Vars, Zeichen, Hilfe; es ist eine eigene Ansicht auf dem
  Kontext-Stack und fügt über `ViewContext.insert` der darunterliegenden Ansicht ein · E4 kein gemeinsames
  Hilfe-Gerüst mit ABA-X1 (andere Struktur) · E5 Menüformat-Einstellung (Name/Beschreibung) entfällt: die Liste zeigt
  beides · E6 MathLives `\operatorname{\mathrm{…}}` normalisiert der Kern-Parser (`normalizeLatex`)

## Fortschritt

- [x] Modell + Hilfe + 3 Specs (Hilfe vollständig, Beispiele/Vorlagen parsen, Katalog) · [x] Overlay, Tasten
      Toolbox/Vars/⇧Vars/Help, Einfügen in Start/RPN/CAS · [x] E2E (Toolbox → gcd, Hilfe, Vars)
- Fehlend gegenüber dem Vorbild: Menü-Einträge für Listen/Matrizen (032), Wahrscheinlichkeitsverteilungen (038),
  App-Funktionen (033 ff.), Einheiten (031), Substituieren/Zähler/Nenner im CAS.

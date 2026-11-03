# Design 045 – ABA-T1: Notizen, Info, Speicherverwaltung, Backup und Export/Import

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 Notizformat = Text mit Markdown-Teilmenge, gerendert als Datenstruktur (`render`) → kein
  `innerHTML` · E2 Backup = alle Speicherdokumente (`settings`, `home`, `rpn`, `cas`, `apps`, `notes`, später
  `programs`) in einem versionierten JSON; Import ganz oder gar nicht, mit Rückfrage; ABA-X1-Format unverändert ·
  E3 Menü-Fassade bleibt je App (das Modell ist app-spezifisch); gemeinsam ist nur `chords` (Accelerator) und die
  Rust-Validierung · E4 App-Info (⇧Apps) seit 033

## Fortschritt

- [x] Logik (Notizen, Backup, Menümodell) mit 8 Specs · [x] Notizen, Speicher, Backup-Dienst, Menü-Dienst,
      HTML-Menü, About · [x] E2E (Notiz → Export → Löschen → Import → Notiz wieder da)
- Offen bis 048: natives Menü in der Desktop-App ansehen.

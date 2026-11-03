# Design 019 – Menüleiste und Kürzel je Betriebssystem

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen

- E1 Menüeinträge kommen aus dem Aktionskatalog (Design 007); native Beschleuniger aus der Keymap
  (`CmdOrCtrl`, `Alt`, `Shift`), nur wo eindeutig (keine Beschleuniger für F1–F6 – die gehören dem WebView).
- E2 macOS: App-Menü mit Über/Einstellungen/Ausblenden/Beenden, Bearbeiten mit Systemeinträgen, Vollbild.
  Windows/Linux: Einstellungen und Beenden unter Datei, Über unter Hilfe.
- E3 Neue Kürzel: ⌘/Strg+, Einstellungen, ⌘/Strg+S Export, ⌘/Strg+O Import, ⌘/Strg+⇧C Ebene 1 kopieren.
- Geprüft in der macOS-App: Menü vorhanden, Über… und Export… (Systemdialog) lösen die Aktionen aus.

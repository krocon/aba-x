# Design 002 – Plattform-Fassaden: Dateien, Menü, Fensterzustand, About

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen
- E1 `FilesApi` (saveText, saveBytes, openText): Desktop = `tauri-plugin-dialog` (Pfad vom Nutzer) + eigene Commands
  `files_write_text|bytes`, `files_read_text` (absoluter Dateipfad, atomar schreiben, 16 MiB Lesegrenze, nur UTF-8);
  Web = Download-Link bzw. `<input type=file>`. Fake für Specs.
- E2 **Ein Menümodell** (`core/menu/menu-model.ts`) für das native Menü (alle Desktop-OS; macOS mit App-Menü und
  System-Edit-Einträgen, ohne die ⌘C/⌘V im WebView nicht ankommen) und das HTML-Menü im Web (Disclosure-Muster).
  Rust `set_app_menu` validiert und baut, Klicks kommen als Ereignis `menu` → `KeyboardDispatcher.run(id)`.
- E3 Fensterzustand über das offizielle `tauri-plugin-window-state` (kleiner, gepflegt) statt eigenem Code.
- E4 About als Dialog mit Version/Plattform aus `PlatformApi`, Lizenzhinweis.
- Capabilities: `core:default`, `core:event:default`, `dialog:allow-save`, `dialog:allow-open`.

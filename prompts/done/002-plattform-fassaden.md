# Prompt 002: Plattform-Fassaden: Dateien, Menü, Fensterzustand

> **Abhängigkeiten:** 001 · **Aufwand:** M · **Betrifft:** Desktop + Web (Rust + Frontend)
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/plattform-fassaden`. Design-Dokument: `prompts/002-plattform-fassaden.design.md`.

## 1. Ziel

Die restlichen Plattformunterschiede bekommen je eine Fassade mit Web- und Tauri-Implementierung, damit spätere Features (Export/Import, Graph-Export, Menü, About) nur noch Fassaden aufrufen: Datei speichern/öffnen, Menümodell, Fensterzustand, About.

## 2. Architektur und Bezug

- ADR 0001 (eine Codebasis, Auswahl nur in `app.config.ts`), ADR 0005 (Persistenz)
- Vorbild FnF: `src/app/core/menu/`, `features/menus/menu-model.ts`, `src-tauri/src/app_menu.rs`, `window_state.rs`, `about.rs`
- Bestehend: `PlatformApi`, `StorageApi`, `INVOKE`-Token, `src/testing/`

## 3. Umsetzung

1. `FilesApi`: `saveFile(name, mime, bytes|text)` und `openFile(accept) → {name, text|bytes} | null`. Desktop über `tauri-plugin-dialog` + eigene Commands (Schreiben in Rust, atomar), Web über Download-Link bzw. `<input type=file>`.
2. `MenuApi` + reines `menu-model.ts`: ein Menümodell (Datei: Export/Import, Bearbeiten: Undo/Redo/Kopieren, Ansicht: Modi, Hilfe: About/Tastenkürzel). Desktop: natives Menü (macOS-Menüleiste; Windows/Linux nativ oder HTML – entscheiden), Ereignisse zurück ins Frontend. Web: kompaktes HTML-Menü am Gerät.
3. Fensterzustand (Größe/Position) auf dem Desktop merken (`tauri-plugin-window-state` oder eigenes `window_state.rs` wie FnF – entscheiden). Web: nichts.
4. About-Dialog (Version, Plattform, Lizenz, Link auf THIRD-PARTY-NOTICES) über `PlatformApi.appInfo()`.
5. Capabilities minimal halten: nur die Dialog-Rechte, die gebraucht werden.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Natives Menü auch unter Windows/Linux?** FnF hat sich für nativ (macOS) + HTML (Win/Linux) entschieden – übernehmen oder überall nativ?
- **Plugin oder eigener Code für Fensterzustand?** Größe, Pflege, Verhalten bei Monitorwechsel.

## 4. Erwartete Dateien und Schnittstellen

- `src/app/core/files/files-api.ts` (+ Tauri/Web, Fake)
- `src/app/core/menu/menu-api.ts`, `src/app/features/menus/menu-model.ts` (rein)
- `src/app/features/about/`
- `src-tauri/src/files.rs`, `app_menu.rs`, ggf. `window_state.rs`; Commands `save_text_file`, `set_app_menu`, …

## 5. Tests und Abnahmekriterien

**Tests**

- menu-model: Struktur, Kürzel je OS, keine doppelten Ids
- Fassaden gegen Fakes (INVOKE-Token)
- Rust: Dateiname/Pfad-Validierung, atomares Schreiben, Menü-Spec-Validierung

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Desktop: Datei → Export speichert eine Testdatei über den Systemdialog; About zeigt Version und OS
- Web: derselbe Export lädt eine Datei herunter; Import über Dateiauswahl
- Fenstergröße bleibt nach Neustart (Desktop)
- Menü per Tastatur bedienbar

## 6. Ausdrücklich nicht Teil dieses Prompts

- Inhalt von Export/Import (Prompt 017)
- Tastenkürzel-Editor
- Auto-Updater

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen
- `docs/architecture.md` §2/§6 (Fassaden, Plugins mit Lizenz)

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund
- welche Tauri-Plugins neu sind und warum

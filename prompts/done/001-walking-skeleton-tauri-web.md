# Prompt 001: Walking Skeleton für Desktop (Tauri 2) und Web ✅

> Status: **erledigt** am 02.11.2026 (Branch `feat/walking-skeleton`) im Rahmen von Phase 0/1 des Master-Prompts.
> Nachtrag am selben Tag: Geräte-Look und Hardware-Tastatur nach Vorgabe Marc (ADR 0006).

## Ziel

Eine leere, aber echte App, die auf dem Desktop und im Browser startet, mit allen Werkzeugen von Files and Folders.

## Ergebnis

- Angular 22 (zoneless) im Root; `src-tauri/` mit Tauri 2.12: `storage_load/save/remove` (atomare JSON-Dokumente,
  kaputte Dateien als `.bad` beiseite, validierte Schlüssel), `get_app_info`. Minimal-Capability, CSP.
- Fassaden `PlatformApi`, `StorageApi` (Tauri | Web/IndexedDB), Fakes in `src/testing/`; Auswahl nur in `app.config.ts`.
- `src/math/` mit `MathResult` und ESLint-Import-Sperre (Gegenprobe gemacht).
- Web-Build `dist/web` mit Service Worker und Manifest; Desktop-Build `dist/desktop`.
- Skripte `version.mjs`, `notices.mjs` (aus FnF), `pnpm check`, Logo `public/logo.svg` → App- und Web-Icons.
- Rechner-Gerät: LCD (Annunciators, `{ MODUS }`, Stack 4…1, MathLive-Zeile, Softmenü), Softkeys F1–F6, Tastenfeld mit
  Shift-Funktionen und Alpha-Buchstaben; Hardware-Tastatur (Tippen, Enter, Esc, F1–F6, Aufleuchten der Taste).

## Geprüft

- `pnpm check` grün (36 Frontend-Specs, 8 Rust-Tests, Skript-Tests, beide Builds, clippy, notices).
- Web-Build in Chromium (Desktop- und 375-px-Breite, hell/dunkel): Eingabe, Tastenfeld, Stack, F-Tasten, Offline.
- macOS-App (`ABA-X1.app`, Debug): Gerät, Softkey F1, Tastenklick → MathLive-Zeile, Accessibility-Namen,
  `ui-state.json` geschrieben und nach Neustart gelesen.
- Nicht geprüft: Windows, Linux (CI-Matrix), Hardware-Tastatur in der App (Hintergrund-Automation kann im WKWebView
  nicht tippen – im Browser geprüft, in der App manuell bestätigen).

## Funde

- Tauri ergänzt `style-src` um Nonces → Angular-Styles fehlten → `dangerousDisableAssetCspModification`.
- MathLives ASCII-Math ist verlustbehaftet → LaTeX parsen (ADR 0003).
- Hohe Formeln vergrößerten das Display und verschoben das Tastenfeld → feste Displayhöhe.

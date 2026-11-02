# Design 022 – Release und Distribution

- Status: vorbereitet · Datum: 02.11.2026 · Lizenz MIT bestätigt (Marc)

## Entscheidungen
- E1 `.github/workflows/release.yml` (aus FnF): Tag `v*` oder manuell → Matrix macOS universal / Windows / Linux mit
  `tauri-action`, **Entwurf** auf GitHub, Signierung nur mit Secrets; Web-Build als Artefakt.
- E2 `scripts/release-notes.mjs` (aus FnF, mit Tests), `pnpm release:notes`.
- E3 Lokal geprüft: `pnpm tauri:build:mac:local` → `.app` 12 MB, `.dmg` 3,9 MB, Release-App startet in < 1,5 s.
- Doku: `docs/release.md`, `docs/distribution.md`, `docs/macos-signing.md`. Kein Tag, kein Push, kein Release.

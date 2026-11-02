# Release

> Prompt 022. **Kein Release, Tag oder Push ohne ausdrückliche Anweisung von Marc.**

## Ablauf

1. `pnpm version:set X.Y.Z` (package.json → Cargo.toml/.lock; tauri.conf.json liest package.json).
2. `pnpm notices` (Lizenzen aktualisieren), `pnpm check`, `pnpm e2e`.
3. `pnpm release:notes` → Markdown aus Conventional Commits seit dem letzten Tag.
4. Commit „chore(release): vX.Y.Z“, Tag `vX.Y.Z`, Push des Tags → Workflow **Release** baut
   macOS (universal `.dmg`/`.app`), Windows (`.msi`, NSIS `.exe`), Linux (`.deb`, `.rpm`, `.AppImage`) und hängt
   sie an einen **Entwurf** auf GitHub; der Web-Build kommt als Workflow-Artefakt.
5. Release Notes in den Entwurf kopieren, prüfen, veröffentlichen.

## Lokal bauen

```bash
pnpm tauri:build:mac:local      # .app + .dmg für die eigene Architektur (geprüft: 3,9 MB .dmg)
pnpm tauri:build:mac            # universal (braucht die Rust-Targets aarch64 + x86_64)
pnpm tauri:build:windows        # auf Windows
pnpm tauri:build:linux          # auf Linux
```

## Signierung (vorbereitet, nicht eingerichtet)

- **macOS:** Secrets `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` und für die
  Notarisierung `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_PRIVATE_KEY` (oder `APPLE_ID`/`APPLE_PASSWORD`/
  `APPLE_TEAM_ID`) – Details `docs/macos-signing.md`. Ohne Secrets: unsignierte Pakete (Gatekeeper-Hinweis).
- **Windows:** `WINDOWS_CERTIFICATE` (PFX, base64) und `WINDOWS_CERTIFICATE_PASSWORD`. Ohne: SmartScreen-Hinweis.
- **Auto-Updater:** nicht aktiv (Nicht-Ziel der ersten Version).

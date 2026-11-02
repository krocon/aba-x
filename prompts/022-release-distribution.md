# Prompt 022: Release und Distribution

> **Abhängigkeiten:** 017, 019 · **Aufwand:** M · **Betrifft:** Desktop + Web + CI
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/release-distribution`. Design-Dokument: `prompts/022-release-distribution.design.md`.

## 1. Ziel

Pakete je OS, Release-Workflow (Tag → Matrix-Build → Entwurf eines GitHub-Release), Signierung/Notarisierung vorbereitet und dokumentiert – nichts wird ohne Freigabe veröffentlicht.

## 2. Architektur und Bezug

- Vorbild FnF Prompt 017, `docs/ci/`, `docs/release.md`, `docs/macos-signing.md`, `scripts/release-notes.mjs`

## 3. Umsetzung

1. `release.yml` (Entwurf), Release Notes aus Conventional Commits, `THIRD-PARTY-NOTICES.txt` in jedem Paket.
2. macOS universal (`tauri:build:mac`), Windows MSI/NSIS, Linux deb/rpm/AppImage – lokal soweit möglich, sonst CI.
3. Signierung vorbereiten (Secrets-Namen, Doku), nicht einrichten.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Lizenz final?** MIT bestätigen lassen (Master-Prompt §9).

## 4. Erwartete Dateien und Schnittstellen

- `.github/workflows/release.yml`
- `docs/release.md`, `docs/distribution.md`, `docs/macos-signing.md`

## 5. Tests und Abnahmekriterien

**Tests**

- scripts-Tests (release-notes)

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Ein Entwurfs-Release mit drei OS-Paketen entsteht in einem Fork/Test-Tag – nur nach Freigabe

## 6. Ausdrücklich nicht Teil dieses Prompts

- Store-Veröffentlichung, Auto-Updater

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

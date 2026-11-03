# Design 025 – ABA-T1: Produktidentität und App-Gerüst

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“, Name ABA-T1)
- Entscheidungen: E1 Name ABA-T1 · E2 `crates/shell` jetzt · E3 Abhängigkeiten zentral · E4 Display DOM + später
  Canvas, 4:3 mit `cqw` · E5 feste Gerätebreite ≤ 440 px · E6 Core-Specs bleiben im Testlauf von ABA-X1

## Bestand → Bedarf

| Baustein                                                    | wofür         | Ergebnis                                                              |
| ----------------------------------------------------------- | ------------- | --------------------------------------------------------------------- |
| `scripts/apps.mjs`                                          | Registry      | Eintrag `aba-t1`                                                      |
| Rust `apps/aba-x1/src-tauri/src/*`                          | Desktop-Hülle | vollständig generisch → `crates/shell` (git mv)                       |
| `packages/core` Fassaden, `APP_IDENTITY`, `STORAGE_DB_NAME` | Plattform     | passt unverändert                                                     |
| `scripts/e2e/run.mjs`                                       | E2E           | Szenarien je App (`scripts/e2e/aba-t1.mjs`), `--build` baut die App   |
| `scripts/notices.mjs`                                       | Lizenzen      | Pfad-Crates zählen als eigene                                         |
| CI/Release                                                  |               | Rust-Matrix je Crate, Frontend-Build je App, Release-Auswahl `aba-t1` |

## Entscheidungen

- **E1 Identität:** siehe ADR 0008.
- **E2 `crates/shell`:** ohne Cargo-Workspace (eigene Locks, kein Umbau der Caches), `builder()` statt
  Commands über Crate-Grenzen (vermeidet Makro-Sichtbarkeit von `#[tauri::command]`).
- **E3 Abhängigkeiten:** zentral, bis eine App eigene Laufzeitpakete braucht.
- **E4/E5 Display:** `aspect-ratio: 4/3`, `container-type: inline-size`; alle Größen im Display in `cqw`.
- **E6 Core-Specs:** laufen weiter einmal (im Projekt `aba-x1`); `aba-t1` testet nur eigene Specs → keine Doppelung.

## Fortschritt

- [x] Shell-Crate, App-Crates, Registry, Angular-Projekt, Icons, leeres Gerät
- [x] Skripte (`rust.mjs`, E2E je App), CI/Release, Notices
- [x] Specs (Tastenmodell, Gerät), E2E Chromium/WebKit inkl. offline und axe

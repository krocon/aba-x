# ADR 0007 – Monorepo für mehrere Rechner

- Status: angenommen · Datum: 03.11.2026 · Prompt 024 (Design: `prompts/done/024-monorepo-mehrere-rechner.design.md`)
- Erweitert ADR 0001 (eine Codebasis für Desktop und Web) um „mehrere Apps“, ADR 0002 (Import-Sperre) um Pakete.

## Kontext
Nach ABA-X1 soll ein zweiter Rechner (grafikfähiger Touch-Rechner, Prompt 025 ff.) entstehen – ohne Mathematik,
Fassaden oder Build-Skripte zu kopieren. Für ABA-X1 darf sich dabei nichts ändern (Bundle-ID, Datenablage,
Web-Basis, Verhalten).

## Entscheidung
```
packages/math   @aba/math – framework-frei (Parser, AST, Numerik, CAS-Adapter, Graph, Worker-Host); reines Vitest
packages/core   @aba/core – Fassaden (Platform, Storage, Files), Compute-Client + Worker, I18nBase, Modal,
                MathStatic; Fakes unter @aba/core/testing
apps/aba-x1     App (src/, public/, src-tauri/, site/, ngsw-config.json, THIRD-PARTY-NOTICES.txt, package.json)
scripts/        gemeinsam; App-Auswahl über scripts/apps.mjs (`--app <name>` / `APP=`, Standard aba-x1)
```
- **Werkzeug:** pnpm-Workspace (`apps/*`, `packages/*`) + Angular-Multi-Project (`newProjectRoot: apps`), kein
  Nx/Turborepo. Pakete sind Quellordner mit Pfad-Alias (`tsconfig.json` `paths`), kein Build-Schritt.
  Unterpfade (`@aba/math/worker/host`) sind erlaubt, damit Nerdamer nur im nachgeladenen Chunk landet.
- **Abhängigkeiten** zentral in der Root-`package.json` (eine Version je Paket, ein `@angular/core`).
- **Sperren (ESLint):** `packages/math` nichts aus Angular, Tauri, MathLive, `@aba/core`, Apps; `packages/core`
  nichts aus Apps, Mathematik nur über `@aba/math`; Apps nur über Aliase, `@aba/core/testing` nur in Specs.
- **Schnitt von core** bewusst schmal: Keymap/Aktionen, Menü, ui-state, Settings, Verlauf, Variablen, Backup,
  Graph bleiben in der App, bis eine zweite App sie wirklich braucht.
- **App-Identität und Daten:** `APP_IDENTITY` (Name, Version aus `apps/<app>/package.json`) und `STORAGE_DB_NAME`
  liefert die App. Alle Web-Apps liegen auf `krocon.de` (eine Origin) → jede App braucht einen eigenen
  IndexedDB-Namen; ABA-X1 behält `aba-x`. Desktop: Datenordner folgt der Bundle-ID (unverändert).
- **Versionen und Releases je App:** Quelle `apps/<app>/package.json`; Tags `<app>-v<semver>` (`aba-x1-v0.2.0`),
  die alten `v0.1.0`/`v0.1.1` gelten als ABA-X1-Tags. `release.yml` baut nur die App des Tags, `ci.yml` alle
  (Rust-Matrix `os × app`). Release-Notes je App: Commits nur im Ordner einer anderen App fallen weg.
- **Rust:** vorerst keine gemeinsame Crate; Kandidaten für `crates/shell` mit der zweiten App: `storage.rs`,
  `files.rs`, `error.rs`, `about.rs`.

## Folgen
+ Zweite App = neuer Ordner unter `apps/`, Eintrag in `scripts/apps.mjs`, Angular-Projekt, `matrix.app` in CI.
+ Git-Historie bleibt (`git mv`, Verschieben und Inhalt in getrennten Commits).
− Notices: npm-Liste ist für alle Apps dieselbe, solange die Abhängigkeiten zentral liegen.
− Core-Specs laufen im `ng test` von ABA-X1 mit; mit App 2 eigenes Testziel nötig.
− e2e-Szenarien und Screenshots sind ABA-X1-spezifisch; App 2 bringt eigene mit.

# Prompt 024: Monorepo für mehrere Rechner

> **Abhängigkeiten:** 001–023 · **Aufwand:** L · **Betrifft:** Repo-Struktur, Build, CI/Release, Doku
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/monorepo`. Design-Dokument: `prompts/024-monorepo-mehrere-rechner.design.md`.

## 1. Ziel

Das Repo so umbauen, dass **mehrere Rechner-Apps** aus einer Codebasis entstehen: ABA-X1 ist die erste App, ein
zweiter Rechner (grafikfähiger Touch-Rechner, eigener Name, Prompt 025 ff.) soll später ohne Kopieren von
Mathematik, Fassaden oder Build-Skripten dazukommen.

**Reines Refactoring:** Für Nutzer ändert sich nichts. ABA-X1 verhält sich danach in Desktop-App und Web-Build
genau wie v0.1.1 – gleiche Bundle-ID `io.github.krocon.abax`, gleiche Datenablage (gespeicherte Stacks, Variablen,
Einstellungen bleiben erhalten), gleiche Web-Basis `/products/aba-x1/`, gleiche Tastenkürzel, gleiche Screenshots.

## 2. Architektur und Bezug

- Heute: eine Angular-App mit `root: ""`, `src/math/` (framework-frei, ESLint-Sperre), `src/app/` (Gerät,
  Fassaden, Features), `src/testing/` (Fakes), `src-tauri/` (eine Crate), `scripts/` (version, notices, e2e,
  screenshots, release-notes), `site/` (Produktseite), Workflows `ci.yml` und `release.yml` (Tag `v*`).
- ADR `docs/decisions/0001-ein-projekt-desktop-und-web.md` (eine Codebasis für Desktop und Web) gilt weiter; der
  Umbau erweitert sie um „mehrere Apps“ → neues ADR `0007-monorepo-mehrere-rechner.md`.
- Vorbild für Workspace-Aufbau: Angular-Multi-Project-Workspace (`projects/`) und pnpm-Workspaces.

### Zielbild (Vorschlag, im Design bestätigen oder begründet ändern)

```
packages/
  math/          heutiges src/math – eigenes Paket (@aba/math), framework-frei, eigene Vitest-Specs, *.cases.json
  core/          app-unabhängige Angular-Bausteine: Fassaden (platform, storage, files, menu) mit Web-, Tauri- und
                 Fake-Implementierung, compute (Worker-Client), i18n-Service, shared (Modal, MathStatic), testing/
apps/
  aba-x1/
    src/         heutiges src/app: Gerät, Keypad, Softkeys, Stack/RPN, CAS-, Graph-Features, Texte, Menümodell
    public/      Icons, Logo, Manifest
    src-tauri/   heutige Crate (Bundle-ID, Fenster, Menü)
    site/        Produktseite
crates/
  shell/         optional: gemeinsamer Rust-Code (storage.rs, files.rs, error.rs, about.rs), wenn sinnvoll
scripts/         gemeinsam, aber mit App-Parameter (version, e2e, screenshots, release-notes, notices)
```

## 3. Umsetzung

1. **Bestand erfassen:** Importgraph `src/app` → was ist ABA-X1-spezifisch, was allgemein (Fassaden, compute, i18n-
   Kern, shared, Graph-Zeichnen?). Tabelle im Design: Datei/Ordner → Ziel (`packages/core`, `apps/aba-x1`, bleibt).
2. **Verschieben mit `git mv`**, damit die Historie erhalten bleibt; Verschieben und inhaltliche Änderungen in
   getrennten Commits.
3. **Pakete anbinden:** pnpm-Workspace (`pnpm-workspace.yaml`), Pfad-Aliase (`@aba/math`, `@aba/core`) in den
   tsconfigs; keine relativen Importe über Paketgrenzen. Die ESLint-Sperre wandert mit: `packages/math` darf nichts
   aus Angular, Tauri, MathLive, `packages/core` oder `apps/` importieren; `packages/core` nichts aus `apps/`.
4. **Angular-Workspace:** Projekt `aba-x1` mit `root: apps/aba-x1`; Konfigurationen `production`, `web`
   (baseHref `/products/aba-x1/`, Service Worker), `development` unverändert; Worker-tsconfig, Assets (MathLive-
   Fonts aus dem Bundle) und Budgets mitnehmen. Tests (`ng test`) für alle Projekte und Pakete.
5. **Tauri:** `apps/aba-x1/src-tauri` mit unveränderter `identifier`, `productName` und Fensterzustand-Plugin;
   `frontendDist`/`devUrl` anpassen. Cargo-Workspace nur, wenn eine gemeinsame Crate entsteht. Prüfen, dass die
   App ihre bisherigen Daten im App-Datenordner wiederfindet.
6. **Root-Skripte mit App-Auswahl:** `pnpm start`, `build`, `build:web`, `tauri dev`, `e2e`, `screenshots*`,
   `serve:web` bleiben für ABA-X1 gleich benannt (Standard-App), zusätzlich z. B. `pnpm --filter`/`APP=<name>`.
   `pnpm check` prüft alle Pakete und Apps.
7. **Versionen und Releases je App:** `scripts/version.mjs` kennt mehrere Apps (package.json, tauri.conf.json,
   Cargo.toml, Cargo.lock je App). Tag-Schema entscheiden (siehe unten); `release.yml` baut nur die App des Tags,
   `ci.yml` alle. `release-notes.mjs` filtert Commits nach App (Scope oder Pfad).
8. **Lizenzen:** `notices.mjs` je App (jede App liefert ihre eigene `THIRD-PARTY-NOTICES.txt` aus).
9. **Doku:** `CLAUDE.md` (Befehle, Layout, Regeln – „Mathematik nur in `packages/math`“), `docs/architecture.md`,
   README, `site/README.md`, neues ADR 0007, `prompts/000-arbeitsweise.md` (Pfade).

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Werkzeug:** nur pnpm-Workspaces + Angular-Multi-Project, oder zusätzlich Nx/Turborepo? (Empfehlung: ohne
  zusätzliches Werkzeug, solange es zwei Apps sind.)
- **`packages/core` als eigenes Paket oder Angular-Library** (ng-packagr) vs. reiner Quellordner mit Pfad-Alias?
  (Empfehlung: Quellordner mit Alias, kein Build-Schritt.)
- **Schnitt von `core`:** Was ist wirklich gerätunabhängig? Menümodell, Keymap/Aktionssystem, Settings, Verlauf,
  Export/Import, Graph-View – je Baustein begründen. Lieber zu wenig teilen als ABA-X1-Details verallgemeinern.
- **Rust:** gemeinsame Crate `crates/shell` jetzt oder erst mit der zweiten App?
- **Tag-Schema:** `aba-x1-v0.2.0` (Präfix je App) oder `v*` für ABA-X1 behalten und neue Apps mit Präfix?
  Bestehende Tags `v0.1.0`, `v0.1.1` bleiben unverändert.
- **Web-Ziele:** Jede App unter `krocon.de/products/<app>/`; Produktseiten je App unter `apps/<app>/site/`?
- **Name des zweiten Rechners:** eigener Produktname und eigenes Logo; Markennamen anderer Hersteller nur als
  Vergleich in der Doku, nie als Produktname, Bundle-ID, Icon oder Gestaltung.

## 4. Erwartete Dateien und Schnittstellen

- `pnpm-workspace.yaml`, `packages/math/**`, `packages/core/**`, `apps/aba-x1/**`
- `angular.json` (Projekte), `tsconfig*.json` (Pfad-Aliase, Referenzen), `eslint.config.js` (Sperren je Paket)
- `.github/workflows/ci.yml`, `.github/workflows/release.yml` (Pfade, App-Auswahl, Tag-Schema)
- `scripts/version.mjs`, `notices.mjs`, `release-notes.mjs`, `e2e/run.mjs`, `screenshots/run.mjs`, `site.test.mjs`
  (App-Parameter, Tests angepasst)
- `docs/decisions/0007-monorepo-mehrere-rechner.md`
- `.claude/launch.json` (lokal, nicht im Repo): Pfade für `web-dist` und `site`

## 5. Tests und Abnahmekriterien

**Tests**

- Alle bestehenden Specs laufen unverändert grün (Anzahl vorher/nachher im Bericht).
- Lint-Test: ein absichtlicher Import aus Angular in `packages/math` bzw. aus `apps/` in `packages/core` wird
  abgelehnt (einmal ausprobieren, im Bericht nennen).
- `scripts/*.test.mjs` decken Versionen und Release-Notes mit mehreren Apps ab.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- `pnpm check` und `pnpm e2e` grün (Chromium + WebKit).
- Web-Build: gleiche Dateien unter `/products/aba-x1/`, kein 404, Service Worker und Offline-Test grün.
- Desktop-App (`pnpm tauri build --debug --bundles app`): startet, Bundle-ID unverändert, **vorhandene Daten
  aus v0.1.1 werden geladen** (Stack, Variablen, Einstellungen), Menü, Fensterzustand, Export/Import.
- `pnpm screenshots` erzeugt Bilder ohne sichtbare Abweichung zu vorher.
- Release-Workflow trocken prüfen (Syntax, Pfade, Matrix) – **ohne** Tag zu pushen oder zu starten.
- `git log --follow` zeigt die Historie verschobener Dateien (Stichprobe).

## 6. Ausdrücklich nicht Teil dieses Prompts

- Der zweite Rechner selbst (Oberfläche, Bedienkonzept, Name) – eigener Prompt 025 ff.; höchstens ein leeres
  Gerüst `apps/<name>/`, wenn das im Design so entschieden wird, um die Struktur zu beweisen.
- Neue Funktionen oder Verhaltensänderungen an ABA-X1.
- Push, Tags, Release, Deployment.

## 7. Doku

- `CLAUDE.md`, `docs/architecture.md`, `docs/roadmap.md`, README, `site/README.md`, ADR 0007,
  `prompts/README.md` (Status), `prompts/000-arbeitsweise.md` (Pfade)

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Zuordnungstabelle alt → neu (Ordner), Anzahl Tests vorher/nachher
- offene Punkte für den zweiten Rechner (was in `core` noch fehlt)
- nicht geprüfte Plattformen mit Grund

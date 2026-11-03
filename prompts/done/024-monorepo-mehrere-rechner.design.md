# Design 024 – Monorepo für mehrere Rechner

- **Status:** umgesetzt (Freigabe Marc 03.11.2026) ✅
- **Datum:** 03.11.2026 · Branch `feat/monorepo` (von `main` @ `43dcaf7`)
- **Auftrag:** [`024-monorepo-mehrere-rechner.md`](024-monorepo-mehrere-rechner.md)
- **Entscheidungen (Kurzfassung):**
  E1 kein Nx/Turborepo – pnpm-Workspace + Angular-Multi-Project ·
  E2 `@aba/math`, `@aba/core` als Quellordner mit Pfad-Alias, kein Build-Schritt ·
  E3 `core` schmal: Fassaden, Compute, i18n-Basis, Modal/MathStatic, Fakes – Menü, Keymap, Features bleiben in der App ·
  E4 Rust: keine gemeinsame Crate jetzt, erst mit der zweiten App ·
  E5 Tags `aba-x1-v0.2.0` (Präfix je App), alte `v0.1.x` bleiben ·
  E6 Web: `krocon.de/products/<app>/`, Produktseite unter `apps/<app>/site/` ·
  E7 kein Gerüst für den zweiten Rechner (Name, Logo → Prompt 025) ·
  E8 Abhängigkeiten bleiben zentral in der Root-`package.json` (eine Version je Paket) ·
  E9 IndexedDB-Name und App-Identität werden injizierbar (zwei Apps teilen sich die Origin `krocon.de`)

---

## 1. Ausgangslage (geprüft am 03.11.2026)

- Toolchain: Node 24.21.0, pnpm 10.25.0, cargo 1.99.1. `pnpm install --frozen-lockfile` ok.
- **Baseline `pnpm check` grün:** Vitest **25 Dateien / 343 Tests**, `scripts/*.test.mjs` **18 Tests**, Rust
  **12 Tests**, Build desktop + web, clippy, fmt, notices. Diese Zahlen müssen nachher gleich sein.
- Tags `v0.1.0`, `v0.1.1`; Version 0.1.1 in `package.json`, `src-tauri/Cargo.toml`, `Cargo.lock`.

## 2. Bestand → Ziel

### 2.1 Importgraph `src/app` (relative Importe, ohne Specs)

- `src/math` wird importiert von: `core/compute`, `features/{calculator,cas,graph,settings,vars}` – immer über
  Tiefenpfade (`math/ast/build`, `math/numeric/evaluate`, …), nie über `math/index.ts`.
- `core/platform/platform-api.ts` importiert `../../../../package.json` (Version fürs Web) und setzt den Namen
  `'ABA-X1'` fest ein.
- `core/storage/storage-api.ts`: `DB_NAME = 'aba-x'` fest, `StorageKey` = Union der ABA-X1-Dokumente.
- `core/menu/*` hängt an `actions/keymap` (`ActionId`, Accelerators), `i18n/texts` (`TextKey`) und
  `desktopMenu()` – durch und durch ABA-X1.
- `core/i18n/i18n.ts` ist generisch bis auf den Import von `texts.ts` (`EN`, `DE`, `TextKey`).
- `core/ui-state` speichert `mode: standard | cas | graph` – ABA-X1-Modi.
- `shared/modal.ts`, `shared/math-static.ts`: keine App-Importe.
- `src/testing/*`: Fakes für Platform, Storage, Files – importieren nur die Fassaden.

### 2.2 Zuordnungstabelle alt → neu

| Alt                                                                                              | Neu                                                  | Begründung                                                            |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------- |
| `src/math/**` (inkl. `*.cases.json`, Specs)                                                      | `packages/math/src/**`                               | framework-frei, schon heute gesperrt                                  |
| `src/app/core/platform/`                                                                         | `packages/core/src/platform/`                        | Fassade; Name/Version per Token `APP_IDENTITY` (E9)                   |
| `src/app/core/storage/`                                                                          | `packages/core/src/storage/`                         | Fassade; DB-Name per Token `STORAGE_DB_NAME`, Schlüssel `string` (E9) |
| `src/app/core/files/`                                                                            | `packages/core/src/files/`                           | Fassade, app-unabhängig                                               |
| `src/app/core/compute/` (Client + `compute.worker.ts`)                                           | `packages/core/src/compute/`                         | dünne Hülle um `@aba/math/worker`                                     |
| `src/app/core/i18n/i18n.ts`                                                                      | `packages/core/src/i18n/i18n-base.ts`                | generische Basis `I18nBase<K>`; Texte bleiben in der App              |
| `src/app/core/i18n/texts.ts` + konkreter `I18n`                                                  | `apps/aba-x1/src/app/core/i18n/`                     | ABA-X1-Texte                                                          |
| `src/app/shared/` (Modal, MathStatic)                                                            | `packages/core/src/shared/`                          | keine App-Abhängigkeit                                                |
| `src/testing/`                                                                                   | `packages/core/testing/` (Alias `@aba/core/testing`) | Fakes der Core-Fassaden, nie im Bundle                                |
| `src/app/core/actions/` (Keymap, Dispatcher)                                                     | `apps/aba-x1/src/app/core/actions/`                  | `ActionId`/Kürzel sind ABA-X1; Touch-Rechner braucht andere           |
| `src/app/core/menu/`                                                                             | `apps/aba-x1/src/app/core/menu/`                     | Menü = Keymap + Texte von ABA-X1                                      |
| `src/app/core/ui-state/`                                                                         | `apps/aba-x1/src/app/core/ui-state/`                 | ABA-X1-Modi                                                           |
| `src/app/features/**`                                                                            | `apps/aba-x1/src/app/features/**`                    | Gerät, Stack, CAS, Graph, Settings, Verlauf, Backup …                 |
| `src/app/app.*`, `src/main.ts`, `src/index.html`, `src/styles.css`                               | `apps/aba-x1/src/…`                                  | App-Hülle                                                             |
| `public/`                                                                                        | `apps/aba-x1/public/`                                | Icons, Logo, Manifest                                                 |
| `ngsw-config.json`                                                                               | `apps/aba-x1/ngsw-config.json`                       | je App eigener Service Worker                                         |
| `src-tauri/`                                                                                     | `apps/aba-x1/src-tauri/`                             | Crate unverändert (Name `aba-x`, Lib `abax_lib`)                      |
| `site/`                                                                                          | `apps/aba-x1/site/`                                  | Produktseite je App (E6)                                              |
| `THIRD-PARTY-NOTICES.txt`                                                                        | `apps/aba-x1/THIRD-PARTY-NOTICES.txt`                | je App (Punkt 8)                                                      |
| `tsconfig.app.json`, `tsconfig.spec.json`, `tsconfig.worker.json`                                | `apps/aba-x1/tsconfig.*.json`                        | je Angular-Projekt                                                    |
| `tsconfig.json`, `angular.json`, `eslint.config.js`, `scripts/`, `docs/`, `LICENSE`, `README.md` | bleiben im Root                                      | gemeinsam                                                             |
| `docs/screenshots/`                                                                              | bleibt                                               | README-Bilder von ABA-X1; Ordner je App erst mit App 2                |
| `dist/desktop`, `dist/web`                                                                       | `dist/aba-x1/desktop`, `dist/aba-x1/web`             | Ausgabe je App                                                        |

**Bewusst nicht geteilt (lieber zu wenig, Punkt „Schnitt von core“):** Keymap/Aktionssystem (Aktionen sind
gerätspezifisch), Menümodell (folgt der Keymap), Settings (Inhalt = ABA-X1-Optionen: Winkelmodus, Format …),
Verlauf/Variablen/Backup (Dokumentformate von ABA-X1, `BUNDLE_FORMAT = 'aba-x-backup'`), Graph-View/-Store
(Kandidat für den Touch-Rechner – wird erst mit Prompt 025 und echtem zweiten Nutzer herausgelöst, dann mit dessen
Anforderungen statt geraten), About-/Shortcut-Dialoge.

## 3. Entscheidungsfragen

### E1 Werkzeug – **pnpm-Workspace + Angular-Multi-Project, kein Nx/Turborepo**

Zwei Apps, wenige Pakete, Builds dauern Sekunden; Caching/Task-Graph lohnt nicht und brächte eine weitere Abhängigkeit
samt Konfigurationssprache. `pnpm -r` / `pnpm --filter` reichen. Wiedervorlage ab drei Apps oder spürbaren CI-Zeiten.

### E2 Paketform – **Quellordner mit Pfad-Alias, kein ng-packagr**

- `tsconfig.json` (Root) `paths`: `@aba/math` → `packages/math/src/index.ts`, `@aba/math/*` → `packages/math/src/*`,
  `@aba/core` → `packages/core/src/index.ts`, `@aba/core/*` → `packages/core/src/*`,
  `@aba/core/testing` → `packages/core/testing/index.ts`. Angulars esbuild-Builder liest `paths`.
- **Unterpfade erlaubt** (`@aba/math/worker/host`): heute lädt `ComputeClient` den Host (mit Nerdamer) per
  `import()` nach; ein reiner Barrel-Import zöge Nerdamer ins Initial-Bundle und sprengt das Budget (1,5 MB Warnung).
- Jedes Paket hat eine `package.json` (`"name": "@aba/math"`, `private`, ohne `dependencies`, E8) für den Workspace
  und `pnpm --filter`.
- `packages/math` testet mit **reinem Vitest** (`packages/math/vitest.config.ts`, Node, ohne jsdom) – das beweist
  nebenbei die Framework-Freiheit. `packages/core`-Specs brauchen TestBed und laufen im `ng test` des Projekts
  `aba-x1` mit (`include`-Option des Unit-Test-Builders). `pnpm test` ruft beides auf.

### E3 Schnitt von `core` – siehe Tabelle 2.2

Generisch gemacht werden nur drei Stellen, jeweils ohne Verhaltensänderung:

- `APP_IDENTITY: InjectionToken<{ name: string; version: string }>` – ABA-X1 liefert `{ name: 'ABA-X1', version }`
  aus `apps/aba-x1/package.json` (ersetzt `WEB_VERSION` + festen Namen).
- `STORAGE_DB_NAME: InjectionToken<string>` – ABA-X1 liefert `'aba-x'` (unverändert, sonst wären Web-Daten weg).
  `StorageApi` nimmt `string`-Schlüssel; `StorageKey` (Union) bleibt in der App.
- `I18nBase<K extends string>` mit Texttabellen per Konstruktor/Token; `apps/aba-x1` definiert
  `@Injectable({ providedIn: 'root' }) class I18n extends I18nBase<TextKey>` – alle bisherigen Aufrufer behalten
  Typprüfung der Schlüssel.

### E4 Rust – **keine gemeinsame Crate jetzt**

Nur ein Nutzer; ein Cargo-Workspace verschöbe `Cargo.lock`/`target`, ändert `cargo metadata` (Notices) und CI-Cache
ohne Nutzen. Kandidaten für `crates/shell` mit App 2: `storage.rs`, `files.rs`, `error.rs`, `about.rs`
(`app_menu.rs` nur, wenn die zweite App ein natives Menü hat). Crate-Name `aba-x` und Lib `abax_lib` bleiben, damit
`Cargo.lock` und Notices sich nicht ändern.

### E5 Tag-Schema – **`<app>-v<semver>`, z. B. `aba-x1-v0.2.0`**

Einheitlich für alle Apps, `release.yml` liest App und Version aus dem Tag (`on.push.tags: ['*-v*']`), prüft beides
gegen `apps/<app>/package.json` und baut nur diese App. `workflow_dispatch` bekommt die Eingabe `app` (Auswahl).
Alte Tags `v0.1.0`/`v0.1.1` bleiben; `release-notes.mjs` behandelt `v*` als Vorgänger-Tags von `aba-x1`.
Alternative „`v*` bleibt ABA-X1“ verworfen: zwei Regeln für immer, und `v*` würde auch `aba-x1-v…`-ähnliche Muster
nicht sauber trennen. GitHub-Release-Name: `ABA-X1 v0.2.0` wie bisher.

### E6 Web-Ziele und Produktseiten

Web-App je App unter `krocon.de/products/<app>/` (ABA-X1 unverändert `/products/aba-x1/`), Produktseite unter
`apps/<app>/site/` (ABA-X1 weiter Ziel `krocon.de/products/aba-x/`). **Achtung, gleiche Origin:** alle Apps liegen
auf `krocon.de` → IndexedDB-Namen müssen je App verschieden sein (E9); Service Worker sind über ihren Scope
(`baseHref`) getrennt, ngsw-Caches tragen den Scope im Namen.

### E7 Zweiter Rechner – **kein Gerüst in 024**

Ein leeres `apps/<name>/` erzwänge jetzt Name, Bundle-ID und Logo. Die Struktur wird stattdessen bewiesen durch:
Lint-Sperren (absichtlicher Verstoß wird abgelehnt), App-Registry mit Tests für mehrere Apps (Fixtures in
`scripts/*.test.mjs`) und `packages/core` ohne jede ABA-X1-Abhängigkeit. Für Name/Logo gilt in 025: eigener
Produktname, Fremdmarken nur als Vergleich in der Doku.

### E8 Abhängigkeiten – **zentral in der Root-`package.json`**

Eine Version je Paket, ein `node_modules`, keine doppelten `@angular/core`-Instanzen, `pnpm-lock.yaml` bleibt
praktisch gleich. App- und Paket-`package.json` tragen Name, Version (Apps) und Skripte. Folge für Notices: die
npm-Liste ist für alle Apps dieselbe (heute korrekt, nur eine App). Sobald App 2 eigene Laufzeit-Pakete braucht,
wandern die Laufzeit-Abhängigkeiten in die App-`package.json` (offener Punkt für 025).

### E9 Identität und Daten bleiben gleich

| Was                               | Wo festgelegt                                          | Nach dem Umbau                                                                                               |
| --------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Bundle-ID `io.github.krocon.abax` | `tauri.conf.json` `identifier`                         | unverändert → gleicher App-Datenordner (`storage.rs` über `app_data_dir()`) und gleiche Fensterzustand-Datei |
| Produktname `ABA-X1`              | `productName`, `APP_IDENTITY`                          | unverändert                                                                                                  |
| Web-Daten                         | IndexedDB `aba-x` auf `krocon.de`                      | `STORAGE_DB_NAME = 'aba-x'` für ABA-X1                                                                       |
| Web-Basis                         | `baseHref` `/products/aba-x1/`                         | unverändert, nur in `angular.json` → Projekt `aba-x1`                                                        |
| Version                           | `package.json` → `tauri.conf.json` `"../package.json"` | Quelle `apps/aba-x1/package.json`; der relative Verweis aus `src-tauri/` stimmt weiter                       |

## 4. Verträge und Konfiguration

### 4.1 Workspace

```yaml
# pnpm-workspace.yaml
packages: ['apps/*', 'packages/*']
```

Root-`package.json`: `private`, ohne `version`, alle Abhängigkeiten (E8), Skripte unten.
`apps/aba-x1/package.json`: `{ "name": "aba-x1", "version": "0.1.1", "private": true, "scripts": { … } }`.

### 4.2 App-Registry `scripts/apps.mjs` (neu, rein, getestet)

```js
export const APPS = {
  'aba-x1': {
    dir: 'apps/aba-x1',
    title: 'ABA-X1',
    project: 'aba-x1', // Angular-Projekt
    crate: 'aba-x', // Cargo.lock-Eintrag
    base: '/products/aba-x1/', // Web
    tagPrefix: 'aba-x1-v',
    legacyTagPrefix: 'v', // v0.1.0, v0.1.1
  },
};
export const DEFAULT_APP = 'aba-x1';
export function appFromArgs(argv, env) {
  /* --app <name> | APP=<name> | DEFAULT_APP; unbekannt → Fehler */
}
```

Alle Skripte (`version`, `notices`, `release-notes`, `e2e/run`, `screenshots/run`, `site.test`) holen Pfade von hier.

### 4.3 Angular (`angular.json`)

- `newProjectRoot: "apps"`, Projekt **`aba-x1`**: `root: apps/aba-x1`, `sourceRoot: apps/aba-x1/src`, Prefix `app`.
- Konfigurationen `production` (→ `dist/aba-x1/desktop`), `web` (→ `dist/aba-x1/web`, `baseHref /products/aba-x1/`,
  `serviceWorker apps/aba-x1/ngsw-config.json`), `development` – Budgets, `allowedCommonJsDependencies`,
  MathLive-Fonts (`node_modules/mathlive/fonts` → `mathlive/fonts`), `webWorkerTsConfig` mitnehmen.
- `serve` Port 1420 unverändert. `test`: `@angular/build:unit-test` mit `include` für
  `apps/aba-x1/src/**/*.spec.ts` und `packages/core/**/*.spec.ts`.
- `tsconfig.worker.json` muss `packages/core/src/compute/compute.worker.ts` einschließen (Worker-URL bleibt relativ
  zum Client: `new URL('./compute.worker', import.meta.url)`).

### 4.4 ESLint (`eslint.config.js`, ein Root-Config)

| Dateien                                                                                                            | verboten                                                                                           |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `packages/math/**`                                                                                                 | `@angular/*`, `@tauri-apps/*`, `mathlive`, `@aba/core*`, `**/apps/**`, `**/packages/core/**`       |
| `packages/core/**`                                                                                                 | `**/apps/**`, relative Pfade nach `**/packages/math/**` (nur `@aba/math…`)                         |
| `apps/**`                                                                                                          | relative Pfade nach `**/packages/**` (nur `@aba/…`), `@aba/core/testing` außerhalb von `*.spec.ts` |
| `pnpm lint` = `eslint apps packages` (direkt statt `ng lint`, damit Pakete ohne Angular-Projekt mitgeprüft werden; |
| gleiche Regeln, Angular-Template-Regeln über den Prozessor wie bisher).                                            |

### 4.5 Tauri (`apps/aba-x1/src-tauri/tauri.conf.json`)

- `identifier`, `productName`, Fenster, CSP inkl. `dangerousDisableAssetCspModification` unverändert.
- `frontendDist: ../../../dist/aba-x1/desktop/browser`, `devUrl` unverändert,
  `beforeDevCommand`/`beforeBuildCommand`: `pnpm start` / `pnpm build` laufen im App-Ordner (App-`package.json`
  delegiert an `ng serve aba-x1` / `ng build aba-x1`; die Angular-CLI findet `angular.json` im Root).
- `licenseFile: ../../../LICENSE`, `resources: { "../THIRD-PARTY-NOTICES.txt": … }` (zeigt jetzt auf die App-Datei),
  `$schema` auf `../../../node_modules/…`.
- Das lokale `src-tauri/target` (gitignoriert) wird per `mv` mitgenommen, damit der Build-Cache bleibt.

### 4.6 Root-Skripte (Standard-App ABA-X1, gleiche Namen)

| Skript                                                                  | neu                                                                                                                                           |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`, `build`, `build:web`, `watch`                                  | `ng serve/build aba-x1 …`                                                                                                                     |
| `tauri`, `dev`, `tauri:*`                                               | `pnpm --filter aba-x1 exec tauri …` bzw. `pnpm --filter aba-x1 tauri:…`                                                                       |
| `test`                                                                  | `vitest run --config packages/math/vitest.config.ts && ng test aba-x1 --watch=false`                                                          |
| `lint`, `format`, `format:check`                                        | über `apps packages scripts`                                                                                                                  |
| `rust:*`                                                                | `--manifest-path apps/aba-x1/src-tauri/Cargo.toml` (je App aus der Registry, ein Skript `scripts/rust.mjs` nur, wenn eine zweite Crate kommt) |
| `version:check`                                                         | prüft **alle** Apps; `version:set [--app aba-x1] X.Y.Z`                                                                                       |
| `notices`, `notices:check`                                              | je App (`--app`, Standard alle)                                                                                                               |
| `e2e`, `screenshots*`, `serve:web`, `release:notes`                     | `--app`/`APP=` mit Standard `aba-x1`                                                                                                          |
| `check`                                                                 | wie heute, über alle Pakete und Apps                                                                                                          |
| Andere App: `APP=<name> pnpm e2e` bzw. `pnpm --filter <name> <skript>`. |

### 4.7 Versionen, Release-Notes, CI

- `version.mjs`: `checkVersions` je App (App-`package.json` ↔ `tauri.conf.json` ↔ `Cargo.toml` ↔ `Cargo.lock`
  der App); `check` ohne `--app` prüft alle.
- `release-notes.mjs [--app aba-x1] [from] [to]`: Default-`from` = jüngster Tag `aba-x1-v*` oder (Legacy) `v*`.
  **Filter nach Pfad:** ein Commit gehört zu App X, außer alle geänderten Dateien liegen unter `apps/<andere App>/`.
  So landen Änderungen an `packages/`, Skripten und Root-Konfiguration bei allen Apps. (Scope-Filter verworfen:
  alte Commits haben keine App-Scopes.)
- `ci.yml`: Frontend-Job wie heute (alle Pakete/Apps über `pnpm check`-Teilschritte), Rust-Job Matrix
  `os × app` (vorerst `app: [aba-x1]`), `rust-cache` mit `workspaces: apps/aba-x1/src-tauri`.
- `release.yml`: Trigger `*-v*`, Job `check` ermittelt `app`/`version` (aus Tag oder Eingabe) und prüft sie;
  `tauri-action` mit `projectPath: apps/aba-x1`, `tagName: aba-x1-v__VERSION__`; Web-Artefakt aus
  `dist/aba-x1/web/browser`. Trocken geprüft mit `actionlint` (falls vorhanden) und einem YAML-Parse-Test – kein Lauf.

## 5. Ablauf und Commits

Verschieben und Inhaltsänderungen getrennt (Historie für `git log --follow`). Reine `git mv`-Commits sind in sich
nicht baubar; der jeweils folgende Commit macht wieder grün.

| #   | Commit                                                                                | Inhalt                                                                                   |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | `docs(prompts): design 024`                                                           | dieses Dokument                                                                          |
| 2   | `refactor(math): move src/math to packages/math`                                      | nur `git mv`                                                                             |
| 3   | `build(math): workspace package @aba/math`                                            | `pnpm-workspace.yaml`, Alias, Importe `@aba/math/…`, Vitest-Config, ESLint-Sperre → grün |
| 4   | `refactor(core): move shared Angular blocks to packages/core`                         | nur `git mv`                                                                             |
| 5   | `refactor(core): app identity, storage db name, i18n base`                            | E3/E9, Importe `@aba/core/…` → grün                                                      |
| 6   | `refactor(aba-x1): move app, public, src-tauri, site to apps/aba-x1`                  | nur `git mv`                                                                             |
| 7   | `build(aba-x1): angular project, tauri paths, app package.json`                       | → grün, Debug-Build                                                                      |
| 8   | `build(scripts): app registry, version/notices/release-notes/e2e/screenshots per app` | Specs zuerst                                                                             |
| 9   | `ci: per-app release tags and paths`                                                  | Workflows                                                                                |
| 10  | `docs: monorepo (ADR 0007, CLAUDE.md, architecture, README, roadmap, arbeitsweise)`   | + Prompt nach `done/`                                                                    |

## 6. Tests und Abnahme (Plan)

- **Zahlen:** Vitest vorher 343 (25 Dateien) = nachher math-Vitest + `ng test`; Scripts 18 → 18 + neue Tests für
  Registry/mehrere Apps; Rust 12 → 12.
- **Neue Script-Tests:** `apps.test.mjs` (Auswahl `--app`/`APP`/Default, unbekannte App), `version.test.mjs` mit
  Fixture zweier Apps (eine inkonsistent → genau deren Fehler), `release-notes.test.mjs` (Pfadfilter: Commit nur
  in `apps/other/` fehlt bei `aba-x1`, Commit in `packages/` erscheint bei beiden; Legacy-Tag `v0.1.1` als Start).
- **Lint-Probe:** absichtlich `import '@angular/core'` in `packages/math` und `import … from '…/apps/…'` in
  `packages/core` → `pnpm lint` rot (im Bericht), danach zurücknehmen.
- **Web:** `pnpm build:web`; Dateiliste `dist/web/browser` (vorher, jetzt sichern) vs. `dist/aba-x1/web/browser`
  vergleichen (gleiche Namen bis auf Hashes), `pnpm e2e` (Chromium + WebKit inkl. Offline/Service Worker, 375 px,
  axe), `pnpm screenshots` → Pixelvergleich mit den eingecheckten Bildern.
- **Desktop:** `pnpm tauri build --debug --bundles app`; Bundle-ID im `Info.plist` prüfen; **Daten aus v0.1.1:**
  vorher mit der v0.1.1-App Stack/Variablen/Einstellungen anlegen (bzw. vorhandenen Ordner
  `~/Library/Application Support/io.github.krocon.abax` sichern), neue App starten → geladen; Menü,
  Fensterzustand, Export/Import per computer-use.
- `git log --follow` Stichproben: `packages/math/src/parser/pratt.ts`, `apps/aba-x1/src-tauri/src/storage.rs`,
  `apps/aba-x1/src/app/features/calculator/calculator-store.ts`.
- Windows/Linux: nur über CI-Matrix prüfbar, Push braucht Freigabe → im Bericht als nicht geprüft.

## 7. Risiken

- **Tauri-CLI findet die Konfiguration nicht vom Root aus** → Aufruf im App-Ordner (`pnpm --filter`), ggf.
  `TAURI_APP_PATH`. Wird in Commit 7 zuerst geprüft.
- **Unit-Test-Builder und Specs außerhalb von `sourceRoot`** (`packages/core`): falls `include` das nicht trägt,
  Ausweichen auf einen Testeinstieg im App-Ordner, der die Core-Specs importiert – oder Core-Specs vorerst unter
  `apps/aba-x1` belassen (würde ich dann melden).
- **Service-Worker-Pfad** in `angular.json` relativ zum Workspace → beim Web-Build prüfen.
- **IDE-Ordner** `.idea/` und `.claude/launch.json` (lokal): Pfade `web-dist`/`site` anpassen.

## 8. Offene Punkte für den zweiten Rechner (Vorschau, Bericht ergänzt sie)

- Gemeinsame Rust-Crate `crates/shell` (E4); Laufzeit-Abhängigkeiten je App (E8, Notices).
- Core-Specs laufen im Projekt `aba-x1` mit – mit App 2 eigenes Testziel, damit sie nicht doppelt laufen.
- Kandidaten zum Herauslösen, wenn App 2 sie braucht: Graph-View/-Zeichnen, Aktionssystem (generischer Dispatcher
  mit app-eigener `ActionId`), Menü-Fassade, Verlauf/Variablen-Logik, Settings-Dialog-Rahmen.
- Screenshots/README je App (`docs/screenshots/<app>/`).

## Fortschritt

- [x] Phase 1: Bestand, Baseline, Design (03.11.2026) – freigegeben
- [x] Commits 2–3 `@aba/math` (`534a28e`, `994b13d`)
- [x] Commits 4–5 `@aba/core` (`35a381a`, `d4c9a22`)
- [x] Commits 6–7 `apps/aba-x1` (`7162e6d`, `f0466ab`)
- [x] Commits 8–9 Skripte, CI (`4b99ba4`, `f6bb045`)
- [x] Ende-zu-Ende Web + Desktop (Daten aus v0.1.1)
- [x] Commit 10 Doku, Prompt nach `done/`

## Ergebnis und Abweichungen vom Entwurf

- **Tests:** Vitest vorher 343 (25 Dateien) → nachher 265 (`@aba/math`, 7 Dateien) + 78 (`ng test aba-x1`,
  18 Dateien) = 343. Skript-Tests 18 → 27 (neu: Registry, Tags, zwei Apps bei Versionen und Release-Notes).
  Rust 12 → 12.
- **Unit-Test-Builder:** `include`-Globs sind relativ zum `sourceRoot` → Core-Specs über
  `../../../packages/core/**/*.spec.ts`; `tsconfig.spec.json` der App schließt sie ein.
- **Lint:** `pnpm lint` = `eslint apps packages`; globale Ignores für `target/`, `gen/`, `dist/` und die statische
  Produktseite (`site/`, war vorher auch nicht im Lint).
- **Tauri:** `pnpm tauri …` = `pnpm --filter aba-x1 exec tauri …`; `beforeDevCommand`/`beforeBuildCommand`
  (`pnpm start`/`pnpm build`) laufen im App-Ordner über dessen `package.json` – kein `TAURI_APP_PATH` nötig.
  `release.yml`: `projectPath: apps/<app>`, `tauriScript: pnpm tauri`.
- **Release-Hilfe:** `node scripts/apps.mjs release <tag> <app>` liefert `app`/`version`/`title` für den Workflow
  und scheitert bei Tag/Version-Abweichung (lokal geprüft).
- **Nebenbefund 1:** Ein Vitest-Cache unter `packages/math/node_modules` war in Commit 3 mitcommittet
  (`.gitignore` kannte nur `/node_modules`) – in Commit 7 entfernt, `.gitignore` jetzt `node_modules/`.
- **Nebenbefund 2:** Die eingecheckten README-Screenshots waren schon auf `main` veraltet (1 px Höhe); `main` und
  dieser Branch erzeugen pixelgleiche Bilder (AE 0). Nicht neu eingecheckt (keine Verhaltensänderung in 024).
- **Nebenbefund 3:** Das native Desktop-Menü bleibt englisch, auch bei Sprache Deutsch (`TauriMenuApi` übersetzt
  nicht) – unverändert seit v0.1.x, nicht Teil von 024.

## Review (separater Agent, 03.11.2026)

Keine Befunde zu Persistenz, Build-Konfiguration und Workflows. Behoben: ESLint-Grenzen waren mit relativen Pfaden
anderer Tiefe umgehbar (math → `../../core/src/…`, core → `../../../math/src/…`, Fakes in Core-Produktivcode,
App → andere App) – jetzt gesperrt und mit Proben geprüft; `--app` ohne Namen fiel still auf ABA-X1 zurück – jetzt
Fehler; CI-Jobname behauptete „every app“. Bewusst belassen: Umgebungsvariable `APP=` (so im Auftrag vorgesehen).

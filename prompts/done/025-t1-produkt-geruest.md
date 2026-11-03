# Prompt 025: ABA-T1 – Produktidentität und App-Gerüst

> **Abhängigkeiten:** 024 · **Aufwand:** L · **Betrifft:** Repo-Struktur, Build, CI/Release, Rust, Doku
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of Done). Branch `feat/t1-geruest`. Design-Dokument:
> `prompts/025-t1-produkt-geruest.design.md`.

## 1. Ziel

Die zweite App `apps/aba-t1` entsteht als **lauffähiges, leeres Gerät**: eigener Name, eigenes Logo, eigene
Bundle-ID und Datenablage, Desktop-App und Web-Build starten, zeigen ein Gerät mit leerem Display (4:3), einer
Menüleiste mit sechs Touch-Schaltflächen und einem Platzhalter-Tastenfeld. Alle Root-Befehle funktionieren mit
`--app aba-t1`; ABA-X1 bleibt unverändert.

## 2. Architektur und Bezug

- ADR 0007 (Monorepo), `prompts/done/024-monorepo-mehrere-rechner.design.md` §8 „Offene Punkte für den zweiten
  Rechner“ – dieser Prompt arbeitet sie ab, soweit ein leeres Gerät sie braucht.
- `scripts/apps.mjs` (Registry), `angular.json`, `tsconfig.json` (Aliase), `eslint.config.js` (Sperre App → andere
  App), `.github/workflows/ci.yml` (`matrix.app`), `release.yml` (App-Auswahl), `scripts/*.test.mjs`.
- `packages/core`: Fassaden, `APP_IDENTITY`, `STORAGE_DB_NAME`, `I18nBase`; Core-Specs laufen heute nur im Projekt
  `aba-x1` mit.

## 3. Umsetzung

1. **Identität (Entscheidung Marc 🛑):** 2–3 Namensvorschläge mit kurzer Prüfung (Domain/Repo-Kollision, keine
   Fremdmarke, passt zu „ABA“), Langform, Untertitel, Bundle-ID (`io.github.krocon.<id>`), Web-Pfad, Tag-Präfix,
   `STORAGE_DB_NAME`. Logo als SVG (Desktop-Raster mit Rand + randloses Web-Logo wie bei ABA-X1), eigene
   Farbwelt, die sich klar von ABA-X1 **und** vom Vorbild unterscheidet.
2. **App anlegen:** `apps/aba-t1/` mit `package.json` (Versionsquelle, 0.1.0), `src/`, `public/` (Icons,
   Manifest), `ngsw-config.json`, `tsconfig.*.json`; Angular-Projekt `aba-t1` (Konfigurationen `production`, `web`,
   `development` wie ABA-X1); Registry-Eintrag; `app.config.ts` als einzige Stelle mit `runsInTauri()`.
3. **Rust:** gemeinsame Crate `crates/shell` (Kandidaten laut 024 E4: `storage.rs`, `files.rs`, `error.rs`,
   `about.rs`) **oder** begründet weiter kopieren – entscheiden. Bei gemeinsamer Crate: Cargo-Workspace, Notices
   und CI-Cache prüfen; ABA-X1-Bundle-ID und Datenordner dürfen sich nicht ändern (Beweis wie in 024).
4. **Tests je App:** Core-Specs bekommen ein eigenes Testziel (nicht doppelt in beiden Apps); `pnpm test` und
   `pnpm check` decken alle Apps ab.
5. **Leeres Gerät:** `T1Device` mit Display-Fläche fester Größe (4:3), Titelzeile (App-Name, Uhrzeit optional,
   Annunciator-Platz), Menüleiste mit 6 Touch-Schaltflächen, Tastenfeld-Raster aus einem Datenmodell (Inhalt folgt
   in 026). Gerätefarben nur als `--dev-*`/`--lcd-*`-Tokens.
6. **Skripte:** `start`, `build`, `build:web`, `tauri`, `e2e`, `screenshots`, `serve:web`, `notices`,
   `version:*`, `release:notes` mit `--app aba-t1`; `.claude/launch.json`-Vorschlag für `aba-t1-web-dist`.
7. **CI/Release:** `matrix.app` um `aba-t1` erweitern, `release.yml`-Auswahl; Workflows nur trocken prüfen.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Name/Logo/Bundle-ID/Web-Pfad** – Vorschläge, Entscheidung Marc.
- **`crates/shell` jetzt?** (Empfehlung: ja, da der zweite Nutzer jetzt real ist.)
- **Laufzeit-Abhängigkeiten je App** (024 E8): bleibt alles in der Root-`package.json` oder wandern App-eigene
  Pakete in `apps/aba-t1/package.json`? Folge für `THIRD-PARTY-NOTICES.txt`.
- **Display-Rendering:** DOM/CSS-Raster, Canvas oder Mischung (Text/MathLive im DOM, Grafik im Canvas)? Prototyp
  mit Messung (Schärfe auf HiDPI, Skalierung bei 375 px, Zugänglichkeit).
- **Gerätegröße und Skalierung:** feste logische Größe mit CSS-Skalierung vs. responsive Raster.

## 4. Erwartete Dateien und Schnittstellen

- `apps/aba-t1/**`, `apps/aba-t1/src-tauri/**` (eigene `identifier`, `productName`, Fensterzustand)
- ggf. `crates/shell/**`, `Cargo.toml` (Workspace)
- `scripts/apps.mjs` (+ Tests), `angular.json`, `tsconfig.json`, `eslint.config.js`, Workflows
- `docs/decisions/0008-aba-t1-identitaet-und-geraet.md`

## 5. Tests und Abnahmekriterien

**Tests**

- Registry/Version/Release-Notes/Notices mit zwei echten Apps; Lint-Probe: Import `apps/aba-t1` → `apps/aba-x1`
  wird abgelehnt.
- Rust-Tests der gemeinsamen Crate; ABA-X1-Rust-Tests unverändert grün.
- Spec: Tastenfeld-Raster wird vollständig aus dem Modell erzeugt; Display behält seine Größe.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- `pnpm tauri dev --app aba-t1` bzw. Debug-Build startet mit eigenem Icon, Titel und Datenordner.
- Web-Build unter dem gewählten Pfad, Service Worker, Offline-Test grün; 375 px und hell/dunkel angesehen.
- ABA-X1: `pnpm check`, `pnpm e2e`, Screenshots unverändert; Daten aus v0.1.x werden weiter geladen.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Tastenbelegung, Eingabe, Rechnen (026 ff.); Push, Tags, Release, Deployment.

## 7. Doku

- `CLAUDE.md` (Apps, Befehle, Layout), `docs/architecture.md`, `docs/roadmap.md` (Abschnitt ABA-T1), ADR 0008,
  README (zweite App erwähnen), `prompts/README.md`, Master-Prompt ABA-T1 (Name, falls geändert)

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- gewählter Name samt Begründung; was aus `packages/core`/`crates/shell` noch fehlt
- nicht geprüfte Plattformen mit Grund

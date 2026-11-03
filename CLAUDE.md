# CLAUDE.md – ABA-X1

> Leitfaden für Claude (und Menschen) zur Arbeit an **ABA-X1** – Advanced Browser Algebra, Scientific & Symbolic
> Calculator: wissenschaftlicher Rechner mit CAS, natürlicher Darstellung und Funktionsplotter als **Desktop-App**
> (Tauri 2: macOS, Windows, Linux) **und** als **Webseite** (statisch, PWA) aus einer Codebasis. Seit Prompt 024 ein
> **Monorepo für mehrere Rechner** (ADR 0007): `packages/math`, `packages/core`, `apps/aba-x1`, `apps/aba-t1`
> (zweiter Rechner, Bedienkonzept nach HP Prime G2, ADR 0008), `crates/shell` (gemeinsame Rust-Hülle).
> Autor: Marc Kronberg · Repo: https://github.com/krocon/aba-x · Lizenz: MIT (bestätigt von Marc, 02.11.2026)
> Produktvision: [`prompts/000-ABA-X1-Master-Prompt.md`](prompts/000-ABA-X1-Master-Prompt.md).
> Vorbild für Aufbau und Arbeitsweise: Files and Folders (FnF), lokal `../files-and-folders-tauri` (nur lesen).

---

## 1. Stand

- Alle Prompts 001–024 sind umgesetzt (024 Monorepo: 03.11.2026; Index `prompts/README.md`, erledigte unter `prompts/done/` mit
  Design-Dokument). ABA-T1: Prompts 025–048 (Vision `prompts/000-ABA-T1-Master-Prompt.md`), Stand im Index. Offen sind nur Schritte mit Freigabe durch Marc: Push/CI auf Windows und Linux, Release mit
  Signierung, Web-Deployment (`docs/roadmap.md` „Offen“).
- Details: `docs/roadmap.md`, `docs/architecture.md`, `docs/technical-evaluation.md`, `docs/decisions/`,
  `docs/mathematics/`.

## 2. Befehle (Root, pnpm 10 via `packageManager`, Node ≥ 22.22.3, Rust stable ≥ 1.90)

| Zweck | Befehl |
|---|---|
| Install | `pnpm install` |
| App-Auswahl | Root-Befehle gelten für **ABA-X1** (Standard-App); andere App: `--app <name>` bzw. `APP=<name>` für Skripte, `pnpm --filter <name> <skript>` für App-Skripte. Registry: `scripts/apps.mjs` |
| Web-Dev-Server | `pnpm start` (= `ng serve aba-x1`, Port 1420; im Browser ohne Tauri → Web-Fassaden, IndexedDB) |
| Desktop-Dev | `pnpm tauri dev` (= `pnpm --filter aba-x1 exec tauri dev`, Tauri läuft im App-Ordner) |
| Tests | `pnpm test` = `pnpm test:math` (reines Vitest + `tsc` in `packages/math`) + `ng test aba-x1` (Vitest + jsdom, inkl. `packages/core`-Specs); `pnpm test:watch` |
| Lint / Format | `pnpm lint` (`eslint apps packages`, Import-Sperren je Paket), `pnpm format`, `pnpm format:check` |
| Build Desktop-Frontend / Web | `pnpm build` → `dist/aba-x1/desktop` (base `/`), `pnpm build:web` → `dist/aba-x1/web` (Service Worker, base `/products/aba-x1/` = Ziel krocon.de) |
| Rust | `pnpm rust:fmt`, `pnpm rust:lint` (clippy `-D warnings`), `pnpm rust:test` (`scripts/rust.mjs`: `crates/shell` + jede App-Crate; `--app <name>`) |
| ABA-T1 | `pnpm --filter aba-t1 start` (Port 1421), `pnpm --filter aba-t1 build`/`build:web`, `pnpm --filter aba-t1 exec tauri dev`, `pnpm e2e --app aba-t1`; Vorschau `aba-t1-dev`/`aba-t1-web-dist` (launch.json) |
| Desktop-Debug-Build | `pnpm tauri build --debug --no-bundle` bzw. `--bundles app` (macOS, für Automation mit Bundle-ID `io.github.krocon.abax`) |
| Pakete | `pnpm tauri:build:mac` · `pnpm tauri:build:windows` · `pnpm tauri:build:linux` (nur mit Freigabe) |
| Version | `pnpm version:check` (alle Apps), `pnpm version:set X.Y.Z [--app aba-x1]` (Quelle `apps/<app>/package.json`) |
| Lizenzen | `pnpm notices` nach jeder Abhängigkeitsänderung (schreibt `apps/<app>/THIRD-PARTY-NOTICES.txt` je App); `pnpm notices:check` |
| Alles prüfen | `pnpm check` |
| Ende-zu-Ende | `pnpm e2e [--app <name>]` (baut den Web-Build der App; Szenarien ABA-T1: `scripts/e2e/aba-t1.mjs`; ABA-X1: Web-Build in Chromium + WebKit: Rechnen, CAS, Graph, echtes Tippen, gerenderter Stack, 375 px, axe, offline); `E2E_BROWSERS=chromium` für einen Browser |
| Screenshots | `pnpm screenshots` → `docs/screenshots/` (README-Bilder), `pnpm screenshots:examples` → `docs/screenshots/examples/` (a: 8.5·88·1.19, b: ∫₀¹ sin 2x exakt/numerisch/Stammfunktion, c: Plot sin((x−1)(x+2))); neue Beispiele in `scripts/screenshots/run.mjs` (`examples`); Szenen sind ABA-X1-spezifisch |
| Produktseite | `apps/aba-x1/site/` – statische Werbeseite (eine `index.html`, CSS inline, kein JS, keine fremden Server; Vorbild comic-commander-tauri/site); Bilder mit `pnpm screenshots:site` → `apps/aba-x1/site/img/`; Test `scripts/site.test.mjs`; ansehen: launch-Konfiguration `site` (Port 4310); Ziel `krocon.de/products/aba-x/`, Hochladen: `apps/aba-x1/site/README.md` |
| Release Notes | `pnpm release:notes [--app aba-x1]` (Conventional Commits seit dem letzten Tag der App `aba-x1-v*`, davor `v*`; ohne Commits, die nur eine andere App betreffen) |
| Release-Tags | `<app>-v<version>`, z. B. `aba-x1-v0.2.0` (alte Tags `v0.1.0`, `v0.1.1` bleiben); `release.yml` baut nur die App des Tags |
| App-Icons | Quellen (in `apps/aba-x1/`): `src-tauri/icons/app-icon.svg` (Desktop, macOS-Raster mit Rand) und `public/logo.svg` (randlos: Favicon/PWA); Farben BG `#262b37`, ∫ `#a98fdb`, x `#68cac3`. Neu erzeugen (im App-Ordner): `pnpm tauri icon src-tauri/icons/app-icon.svg` (danach `src-tauri/icons/android`, `ios` löschen) und für das Web `pnpm tauri icon public/logo.svg -o <tmp> -p 32,180,192,512` → `public/icons/icon-<n>.png` |

Web-Build lokal ansehen: `pnpm serve:web` → http://localhost:4300/products/aba-x1/ (wie gehostet; Konfiguration
`web-dist` in `.claude/launch.json`). Service Worker beim Testen ggf. abmelden, sonst sieht man den alten Stand.
Im Web-Code nie absolute Pfade (`/…`) verwenden – immer relativ zum `<base href>`.

## 3. Layout

```
packages/math/src/           @aba/math – framework-frei (ESLint-Sperre), eigene Vitest-Config, package.json
  result.ts, functions.ts    MathResult/Fehlercodes; Funktionskatalog (einzige Quelle, auch CAS-Positivliste)
  ast/                       Knoten (13 Typen), Builder, freeSymbols, substitute
  parser/                    Pratt-Kern, Text- und LaTeX-Front-End, Statements (a = …, f(x) = …), *.cases.json
  serializer.ts, pretty.ts   AST → Text/LaTeX (Round-Trip); Lehrbuchform von CAS-Ausgaben (√, Brüche, Polynomordnung)
  numeric/                   evaluate (double, Fehlercodes, Grad), roots (Brent …), derivative (Ridders), quadrature (GK 7/15)
  symbolic/                  SymbolicEngine, Nerdamer-Brücke + Engine, verify (numerische Stichprobe jedes Ergebnisses)
  graph/                     viewport, sampler (Pol-/Sprungerkennung), analysis (Nullstellen, Extrema, Fläche …)
  value/                     Value (real/komplex …), evaluateValue (ABA-T1-Startansicht, delegiert Reelles), format
  worker/                    Protokoll + Host (CAS und `evaluate` im Web Worker)
packages/core/               @aba/core – app-unabhängige Angular-Bausteine (nie aus apps/ importieren)
  src/platform|storage|files Fassaden (Web + Tauri); APP_IDENTITY, STORAGE_DB_NAME liefert die App
  src/compute/               ComputeClient (Worker, Timeout, Abbruch), compute.worker.ts
  src/i18n/i18n-base.ts      I18nBase<K> (Sprachumschaltung); Texte bringt die App mit
  src/actions/               chords.ts (Kürzel je OS), ActionDispatcher<A>, GestureRecognizer (Touch, rein)
  src/shared/                Modal, MathStatic (`<app-math>` mit Neu-Rendern), MathField (MathLive-Zeile ohne App-Logik)
  testing/                   Fakes (Storage, Platform, Files) = @aba/core/testing, nur in Specs
apps/aba-x1/                 die App ABA-X1 (package.json = Versionsquelle, ngsw-config.json, THIRD-PARTY-NOTICES.txt)
  src/app/app.config.ts      einzige Stelle mit runsInTauri(): Fassaden, APP_IDENTITY, STORAGE_DB_NAME 'aba-x', Service Worker nur Web
  src/app/app.ts             Seite: Menü, Gerät, Dialoge, Statuszeile; Handler für Export/Import/About/SETUP
  src/app/core/actions/      keymap.ts (rein, je OS), KeyboardDispatcher (Capture-Listener, Aktionen)
  src/app/core/menu/         menu-model.ts (ein Modell) + MenuApi (nativ/HTML)
  src/app/core/i18n/         I18n (extends I18nBase), texts.ts (EN/DE, Vollständigkeits-Spec)
  src/app/core/ui-state/     Modus (standard/cas/graph)
  src/app/features/          calculator/ (device/, keypad/, Store, Engine, …), cas/, graph/, vars|history|backup|
                             settings|about|help|menus/
  public/, src-tauri/, site/ Icons/Manifest; Crate (nur lib.rs: `aba_shell::builder()`); Produktseite
apps/aba-t1/                 zweiter Rechner (ADR 0008), Bedienung: docs/aba-t1.md; core/device/DeviceStore (Kontext-Stack der
                             Ansichten: ViewContext), core/nav (Bildschirme), core/actions (Shift/Alpha, Keymap,
                             T1Keyboard), features/device|home|settings
crates/shell/                gemeinsame Rust-Hülle (commands.rs, storage.rs, files.rs, app_menu.rs, about.rs, error.rs),
                             eigene Cargo.lock, kein Workspace
scripts/                     apps.mjs (App-Registry), version, notices, release-notes, rust.mjs (+ Tests), e2e/run.mjs
                             (+ aba-t1.mjs), screenshots/run.mjs
docs/                        architecture, roadmap, technical-evaluation, decisions/, mathematics/, deployment, release,
                             distribution, macos-signing, accessibility, ci/, screenshots/
```

## 4. Regeln

- **Mathematik nur in `packages/math/`**, nie in Komponenten, nie in Rust. Fehler als `MathResult`, nie erfundene
  Ergebnisse; symbolisch und numerisch sichtbar unterscheiden.
- Plattformunterschiede nur über Fassaden; jede Fassade hat eine Web- und eine Tauri-Implementierung und einen Fake.
- **Paketgrenzen (ADR 0007):** Importe über Paketgrenzen nur per Alias (`@aba/math/…`, `@aba/core/…`), nie relativ;
  `packages/core` kennt keine App; App-Spezifisches (Keymap, Menü, Texte, Features) bleibt in `apps/<app>/`, bis
  eine zweite App es wirklich braucht. Neue App: Ordner unter `apps/`, Eintrag in `scripts/apps.mjs`,
  Angular-Projekt, eigener `STORAGE_DB_NAME`, eigener Dev-Port, Crate per Pfad an `crates/shell`, `matrix.crate` und
  Build-Schritte in `ci.yml`, Auswahl in `release.yml`, E2E-Szenarien in `scripts/e2e/<app>.mjs`.
- ABA-T1 (ADR 0008): Bedienkonzept wie HP Prime, aber nie HP-Namen, -Logos, -Farben, -Grafiken oder Handbuchtexte.
  Gerätefarben nur als `--dev-*`/`--key-*`/`--lcd-*`-Tokens; Display fest 4:3, Größen darin in `cqw`.
- App-Crates brauchen `tauri-plugin-dialog` als direkte Abhängigkeit (sonst kennt `tauri-build` die Capabilities nicht).
- Jedes Feature in **Desktop-App und Web-Build** prüfen (Master-Prompt §6.5).
- MathLive: nur `latex` weiterverarbeiten (ASCII-Math ist verlustbehaftet); Fonts aus dem Bundle, kein CDN.
- Nerdamer (ab 009): nur über den Adapter, Funktionen per Positivliste (`ln` ist dort unbekannt → falsches `0`).
- Tauri-CSP: `dangerousDisableAssetCspModification: ["style-src"]` nicht entfernen, sonst fehlen alle
  Komponenten-Styles in der App.
- Gerät: Display hat feste Höhe (Tastenfeld darf nie springen); Tasten nehmen der Eingabezeile nie den Fokus
  (`pointerdown` → `preventDefault`).
- Tastatur: Hardware-Tastatur ist gleichwertig zur virtuellen; neue Kürzel in `keypad-model.ts`
  (`keyIdForPhysical`) bzw. ab Prompt 007 im Aktionssystem.
- Barrierefreiheit: jede Taste hat `aria-label`, Shift/Alpha `aria-pressed`, Softkeys nennen ihr F-Kürzel.
- Kein Push, kein Release, kein Deployment, keine Signierung ohne ausdrückliche Anweisung.
- Commits: Conventional Commits, Branch `feat/<slug>`.

## 5. Bekannte Fallen

- MathLives `<math-span>` rendert eine geänderte Textkante nicht neu → Formeln immer über `<app-math [latex]>`
  (`shared/math-static.ts`) zeigen; E2E prüft das gerenderte Bild (`renderedStack`).
- Jede CAS-Antwort läuft durch `symbolic/verify.ts`; neue Operationen brauchen eine passende Gegenprobe.
- LaTeX in JS-Strings: `\\;` doppelt escapen oder `String.raw` (ein einfaches `\;` ist nur `;`).
- `{` und `}` sind in Angular-Templates Block-Syntax → Literale als Ausdruck schreiben (`{{ '{ ' + x + ' }' }}`).
- Service Worker im Web-Build cacht aggressiv → beim lokalen Testen abmelden.
- Hintergrund-Automation (computer-use) kann im WKWebView nicht tippen; Klicks auf Buttons gehen. Ein Fenster im
  Hintergrund zeichnet asynchrone Ergebnisse (Worker) oft erst beim nächsten Ereignis neu – kein App-Fehler; der
  Zustand lässt sich mit Playwright-WebKit gegen den Web-Build prüfen.
- Klicks per Automation verändern manchmal die Fenstergröße: nach jedem Klick-Batch neu `app_screenshot`/`app_ax_find`.

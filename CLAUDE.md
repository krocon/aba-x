# CLAUDE.md – ABA-X1

> Leitfaden für Claude (und Menschen) zur Arbeit an **ABA-X1** – Advanced Browser Algebra, Scientific & Symbolic
> Calculator: wissenschaftlicher Rechner mit CAS, natürlicher Darstellung und Funktionsplotter als **Desktop-App**
> (Tauri 2: macOS, Windows, Linux) **und** als **Webseite** (statisch, PWA) aus einer Codebasis.
> Autor: Marc Kronberg · Repo: https://github.com/krocon/aba-x · Lizenz: MIT (bestätigt von Marc, 02.11.2026)
> Produktvision: [`prompts/000-ABA-X1-Master-Prompt.md`](prompts/000-ABA-X1-Master-Prompt.md).
> Vorbild für Aufbau und Arbeitsweise: Files and Folders (FnF), lokal `../files-and-folders-tauri` (nur lesen).

---

## 1. Stand

- Alle Prompts 001–023 sind umgesetzt (02.11.2026, Index `prompts/README.md`, erledigte unter `prompts/done/` mit
  Design-Dokument). Offen sind nur Schritte mit Freigabe durch Marc: Push/CI auf Windows und Linux, Release mit
  Signierung, Web-Deployment (`docs/roadmap.md` „Offen“).
- Details: `docs/roadmap.md`, `docs/architecture.md`, `docs/technical-evaluation.md`, `docs/decisions/`,
  `docs/mathematics/`.

## 2. Befehle (Root, pnpm 10 via `packageManager`, Node ≥ 22.22.3, Rust stable ≥ 1.90)

| Zweck | Befehl |
|---|---|
| Install | `pnpm install` |
| Web-Dev-Server | `pnpm start` (Port 1420; im Browser ohne Tauri → Web-Fassaden, IndexedDB) |
| Desktop-Dev | `pnpm tauri dev` |
| Tests | `pnpm test` (Vitest + jsdom über `ng test`), `pnpm test:watch` |
| Lint / Format | `pnpm lint` (inkl. Import-Sperre `src/math`), `pnpm format`, `pnpm format:check` |
| Build Desktop-Frontend / Web | `pnpm build` → `dist/desktop` (base `/`), `pnpm build:web` → `dist/web` (Service Worker, base `/products/aba-x1/` = Ziel krocon.de) |
| Rust | `pnpm rust:fmt`, `pnpm rust:lint` (clippy `-D warnings`), `pnpm rust:test` |
| Desktop-Debug-Build | `pnpm tauri build --debug --no-bundle` bzw. `--bundles app` (macOS, für Automation mit Bundle-ID `io.github.krocon.abax`) |
| Pakete | `pnpm tauri:build:mac` · `pnpm tauri:build:windows` · `pnpm tauri:build:linux` (nur mit Freigabe) |
| Version | `pnpm version:check`, `pnpm version:set X.Y.Z` (Quelle `package.json`) |
| Lizenzen | `pnpm notices` nach jeder Abhängigkeitsänderung; `pnpm notices:check` |
| Alles prüfen | `pnpm check` |
| Ende-zu-Ende | `pnpm e2e` (Web-Build in Chromium + WebKit: Rechnen, CAS, Graph, echtes Tippen, gerenderter Stack, 375 px, axe, offline); `E2E_BROWSERS=chromium` für einen Browser |
| Screenshots | `pnpm screenshots` → `docs/screenshots/` (README-Bilder), `pnpm screenshots:examples` → `docs/screenshots/examples/` (a: 8.5·88·1.19, b: ∫₀¹ sin 2x exakt/numerisch/Stammfunktion, c: Plot sin((x−1)(x+2))); neue Beispiele in `scripts/screenshots/run.mjs` (`examples`) |
| Release Notes | `pnpm release:notes` (Conventional Commits seit dem letzten Tag) |

Web-Build lokal ansehen: `pnpm serve:web` → http://localhost:4300/products/aba-x1/ (wie gehostet; Konfiguration
`web-dist` in `.claude/launch.json`). Service Worker beim Testen ggf. abmelden, sonst sieht man den alten Stand.
Im Web-Code nie absolute Pfade (`/…`) verwenden – immer relativ zum `<base href>`.

## 3. Layout

```
src/math/                    framework-frei (ESLint-Sperre)
  result.ts, functions.ts    MathResult/Fehlercodes; Funktionskatalog (einzige Quelle, auch CAS-Positivliste)
  ast/                       Knoten (13 Typen), Builder, freeSymbols, substitute
  parser/                    Pratt-Kern, Text- und LaTeX-Front-End, Statements (a = …, f(x) = …), *.cases.json
  serializer.ts, pretty.ts   AST → Text/LaTeX (Round-Trip); Lehrbuchform von CAS-Ausgaben (√, Brüche, Polynomordnung)
  numeric/                   evaluate (double, Fehlercodes, Grad), roots (Brent …), derivative (Ridders), quadrature (GK 7/15)
  symbolic/                  SymbolicEngine, Nerdamer-Brücke + Engine, verify (numerische Stichprobe jedes Ergebnisses)
  graph/                     viewport, sampler (Pol-/Sprungerkennung), analysis (Nullstellen, Extrema, Fläche …)
  worker/                    Protokoll + Host (CAS im Web Worker)
src/app/
  app.config.ts              einzige Stelle mit runsInTauri(): Platform/Storage/Files/Menu-Fassaden, Service Worker nur Web
  app.ts                     Seite: Menü, Gerät, Dialoge, Statuszeile; Handler für Export/Import/About/SETUP
  core/actions/              keymap.ts (rein, je OS), KeyboardDispatcher (Capture-Listener, Aktionen)
  core/compute/              ComputeClient (Worker, Timeout, Abbruch), compute.worker.ts
  core/files/, core/menu/    FilesApi (Dialog/Download), menu-model.ts (ein Modell) + MenuApi (nativ/HTML)
  core/i18n/                 I18n-Service, texts.ts (EN/DE, Vollständigkeits-Spec)
  core/platform/, storage/, ui-state/   wie seit 001 (+ Dokument `graph`)
  features/calculator/       device/ (Gerät, softkeys.ts = alle Softmenüs), keypad/, calculator-store.ts (Stack, RPN,
                             Warteschlange, HIST/Graph-Tasten), calculator-engine.ts (Auswertung, CAS-Operationen),
                             evaluation-logic.ts, entry-stack.ts, math-input.ts
  features/cas/              cas-logic.ts (Variable wählen, Lösungen, + C)
  features/graph/            GraphStore, GraphView (Canvas), graph-draw.ts, PNG/SVG-Export
  features/vars|history|backup|settings|about|help|menus/   Variablen, Verlauf, Export/Import, SETUP, Dialoge, HTML-Menü
  shared/                    Modal, MathStatic (`<math-span>` mit Neu-Rendern)
  testing/                   Fakes (Storage, Platform, Files)
src-tauri/src/               commands.rs (dünn), storage.rs, files.rs, app_menu.rs, about.rs, error.rs; Plugins dialog + window-state
scripts/                     version, notices, release-notes (+ Tests), e2e/run.mjs, screenshots/run.mjs
docs/                        architecture, roadmap, technical-evaluation, decisions/, mathematics/, deployment, release,
                             distribution, macos-signing, accessibility, ci/, screenshots/
```

## 4. Regeln

- **Mathematik nur in `src/math/`**, nie in Komponenten, nie in Rust. Fehler als `MathResult`, nie erfundene
  Ergebnisse; symbolisch und numerisch sichtbar unterscheiden.
- Plattformunterschiede nur über Fassaden; jede Fassade hat eine Web- und eine Tauri-Implementierung und einen Fake.
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

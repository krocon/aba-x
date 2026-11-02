# CLAUDE.md – ABA-X1

> Leitfaden für Claude (und Menschen) zur Arbeit an **ABA-X1** – Advanced Browser Algebra, Scientific & Symbolic
> Calculator: wissenschaftlicher Rechner mit CAS, natürlicher Darstellung und Funktionsplotter als **Desktop-App**
> (Tauri 2: macOS, Windows, Linux) **und** als **Webseite** (statisch, PWA) aus einer Codebasis.
> Autor: Marc Kronberg · Repo: https://github.com/krocon/aba-x · Lizenz: MIT (vor Veröffentlichung bestätigen)
> Produktvision: [`prompts/000-ABA-X1-Master-Prompt.md`](prompts/000-ABA-X1-Master-Prompt.md).
> Vorbild für Aufbau und Arbeitsweise: Files and Folders (FnF), lokal `../files-and-folders-tauri` (nur lesen).

---

## 1. Stand

- Phase 0 (Analyse, Bewertung, Architektur) und Phase 1 (Walking Skeleton, Prompt 001) sind fertig, dazu der
  Geräte-Look mit Hardware-Tastatur (ADR 0006). **Es wird noch nichts ausgerechnet.**
- Als Nächstes: Prompt 002 (Plattform-Fassaden Dateien/Menü) oder direkt 003 (AST + LaTeX-Parser) – Reihenfolge in
  `prompts/README.md`.
- Details: `docs/roadmap.md`, `docs/architecture.md`, `docs/technical-evaluation.md`, `docs/decisions/`.

## 2. Befehle (Root, pnpm 10 via `packageManager`, Node ≥ 22.22.3, Rust stable ≥ 1.90)

| Zweck | Befehl |
|---|---|
| Install | `pnpm install` |
| Web-Dev-Server | `pnpm start` (Port 1420; im Browser ohne Tauri → Web-Fassaden, IndexedDB) |
| Desktop-Dev | `pnpm tauri dev` |
| Tests | `pnpm test` (Vitest + jsdom über `ng test`), `pnpm test:watch` |
| Lint / Format | `pnpm lint` (inkl. Import-Sperre `src/math`), `pnpm format`, `pnpm format:check` |
| Build Desktop-Frontend / Web | `pnpm build` → `dist/desktop`, `pnpm build:web` → `dist/web` (Service Worker) |
| Rust | `pnpm rust:fmt`, `pnpm rust:lint` (clippy `-D warnings`), `pnpm rust:test` |
| Desktop-Debug-Build | `pnpm tauri build --debug --no-bundle` bzw. `--bundles app` (macOS, für Automation mit Bundle-ID `io.github.krocon.abax`) |
| Pakete | `pnpm tauri:build:mac` · `pnpm tauri:build:windows` · `pnpm tauri:build:linux` (nur mit Freigabe) |
| Version | `pnpm version:check`, `pnpm version:set X.Y.Z` (Quelle `package.json`) |
| Lizenzen | `pnpm notices` nach jeder Abhängigkeitsänderung; `pnpm notices:check` |
| Alles prüfen | `pnpm check` |

Web-Build lokal ansehen: `python3 -m http.server 4300 -d dist/web/browser` (Konfiguration `web-dist` in
`.claude/launch.json`). Service Worker beim Testen ggf. abmelden, sonst sieht man den alten Stand.

## 3. Layout

```
src/
  math/                      framework-frei (ESLint-Sperre): result.ts (MathResult); geplant ast/, parser/,
                             symbolic/, numeric/, graph/, worker/
  app/app.config.ts          einzige Stelle mit runsInTauri() → Tauri- oder Web-Fassaden, Service Worker nur Web
  app/app.ts                 Seite: CalculatorDevice + Statuszeile (Plattform, Version, Speicherprobleme)
  app/core/platform/         PlatformApi (Tauri/Web), INVOKE-Token (Tests ersetzen die IPC), WEB_VERSION aus package.json
  app/core/storage/          StorageApi: TauriStorageApi (storage_*), IndexedDbStorageApi, IDB_FACTORY-Token
  app/core/ui-state/         ui-state-logic.ts (rein: Modi, sanitize, neuere Schemaversion nie überschreiben), UiStateStore
  app/features/calculator/   device/ (CalculatorDevice: LCD, Softkeys, document:keydown; softkeys.ts), keypad/
                             (keypad-model.ts rein, Keypad), calculator-store.ts (Stack, Shift, Meldung, MathEditor),
                             entry-stack.ts (rein), math-input.ts (MathLive, lazy, MATH_FIELD_FACTORY-Token)
  testing/                   FakeStorageApi, FakePlatformApi – nie im Produktivcode importieren
  styles.css                 Seiten-Tokens light/dark; Gerätefarben fest in calculator-device.css (--dev-*, --lcd-*)
src-tauri/src/               lib.rs (Handler), commands.rs (dünn), storage.rs (rein, getestet), about.rs, error.rs
public/                      logo.svg (Quelle aller Icons), icons/, manifest.webmanifest
scripts/                     version.mjs, notices.mjs (+ Tests) – aus FnF übernommen
docs/                        architecture, roadmap, technical-evaluation, decisions/, spikes/
prompts/                     000-ABA-X1-Master-Prompt.md (Vision), 000-arbeitsweise.md, README.md (Index), NNN-*.md, done/
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

- `{` und `}` sind in Angular-Templates Block-Syntax → Literale als Ausdruck schreiben (`{{ '{ ' + x + ' }' }}`).
- Service Worker im Web-Build cacht aggressiv → beim lokalen Testen abmelden.
- Hintergrund-Automation (computer-use) kann im WKWebView nicht tippen; Klicks auf Buttons gehen.

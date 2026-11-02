# Architektur – ABA-X1

> Stand: 02.11.2026 (alle Prompts 001–023). Struktur im Detail: `CLAUDE.md` §3. Entscheidungen im Einzelnen: [`docs/decisions/`](decisions/).
> Bewertung der Bibliotheken: [`technical-evaluation.md`](technical-evaluation.md).

## 1. Überblick

```
┌──────────────────────────── Angular 22 (zoneless, Signals, OnPush) ────────────────────────────┐
│  features/calculator   CalculatorDevice (LCD, Softkeys, Keypad), CalculatorStore, MathInput     │
│  features/…            (cas, graph, history, settings – Folge-Prompts)                          │
│  core/ui-state         UiStateStore (Modus) ── StorageApi                                       │
│  core/platform         PlatformApi ── TauriPlatformApi | WebPlatformApi                         │
│  core/storage          StorageApi  ── TauriStorageApi  | IndexedDbStorageApi                    │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│  src/math  (framework-frei: kein Angular, kein Tauri, kein MathLive)                            │
│    result.ts (MathResult) · ast/ · parser/ · symbolic/ · numeric/ · graph/ · worker/  (geplant)  │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
          │ invoke (nur Desktop)                                  │ nur Web
┌─────────▼──────────── src-tauri (Rust, dünn) ───────┐   ┌───────▼───────────────────────┐
│ commands.rs → storage.rs (atomare JSON-Dokumente)   │   │ IndexedDB, Service Worker     │
│             → about.rs (Version, OS, Arch)          │   │ (ngsw, offline)               │
└─────────────────────────────────────────────────────┘   └───────────────────────────────┘
```

## 2. Schichten und Regeln

| Schicht | Ort | Darf importieren | Regel |
|---|---|---|---|
| Mathematik-Kern | `src/math/` | nur sich selbst und reine npm-Pakete (Nerdamer im Adapter) | ESLint `no-restricted-imports`; Fehler als `MathResult` |
| Fassaden | `src/app/core/*/…-api.ts` | Angular, `@tauri-apps/api` | je Fassade eine Tauri- und eine Web-Implementierung + Fake in `src/testing/` |
| Stores | `…-store.ts` | Fassaden, reine Logik | Signals; Logik in `*-logic.ts`/`entry-stack.ts`/`keypad-model.ts` (rein, eigene Specs) |
| Komponenten | `src/app/features/` | Stores | keine Rechenlogik, keine `isTauri()`-Abfragen |
| Rust | `src-tauri/src/` | std, serde, tauri | reine Module ohne Tauri (`storage.rs`, `about.rs`) + dünne `commands.rs` |

Die Auswahl der Implementierung je Plattform passiert **nur** in `src/app/app.config.ts` (`runsInTauri()`).

## 3. Persistenz (ADR 0005)

| Dokument | Inhalt | seit |
|---|---|---|
| `ui-state` | `{ schemaVersion: 1, mode }` | Phase 1 |
| `settings`, `history`, `variables`, `functions` | reserviert | Prompts 008, 017, 018 |

- Desktop: `<app_data_dir>/<key>.json` (macOS `~/Library/Application Support/io.github.krocon.abax/`).
  Commands: `storage_load(key) → { value, setAside }`, `storage_save(key, value)`, `storage_remove(key)`;
  Fehler `{ code, message }` mit `invalid_key`, `too_large`, `io`, `no_data_dir`.
- Web: IndexedDB `aba-x` / Store `documents`; ohne IndexedDB → `{ code: 'unavailable' }`, die App läuft weiter.
- Neuere `schemaVersion` → lesen, nie überschreiben (`sanitizeUiState`).

## 4. Rechner-Gerät (ADR 0006)

- `CalculatorDevice` – Display und Tastatur, hört als einzige Stelle auf `document:keydown` (F1–F6, Tippen außerhalb
  der Eingabezeile, Aufleuchten der passenden Taste). Wird mit dem Aktionssystem (Prompt 007) zentralisiert.
- `keypad-model.ts` – Tasten, Shift-Funktionen, Alpha-Buchstaben, `resolveKey`, `nextShift`, Zuordnung
  Hardware-Taste → virtuelle Taste. Rein, getestet.
- `CalculatorStore` – Stack (`entry-stack.ts`), Shift/Alpha, Meldung, Tastendruck → `MathEditor` (die Eingabezeile).
- `MathInput` – MathLive-Feld; `Enter` legt die Zeile auf den Stack, `Esc` leert sie.
- Stack-Einträge werden mit MathLives `<math-span>` statisch gesetzt (Text-Bindung, kein `innerHTML`).

## 5. Sicherheit

- Tauri-Capability `core:default`, keine Plugins für Dateisystem, Shell oder Netzwerk.
- CSP: `default-src 'self'`, `connect-src ipc: http://ipc.localhost`, `font-src 'self' data:`; `style-src` ohne
  Nonce-Ergänzung (`dangerousDisableAssetCspModification`), weil Angular/MathLive Inline-Styles setzen.
- Speicher-Schlüssel werden in Rust gegen `^[a-z][a-z0-9-]{0,31}$` geprüft – nie Pfade.

## 6. Rechenweg einer Eingabe

```
MathLive-Zeile ──LaTeX──► parseLatexStatement ──AST──► CalculatorEngine.prepare (Ans, Variablen, Funktionen inline, Grad)
                                                         │
                       numerisch (Hauptthread) ◄─────────┼─────────► CAS (Web Worker, ComputeClient, Zeitlimit)
                       evaluateNumeric → „≈ …“, Fallback │            NerdamerEngine → verify (Stichprobe) → prettify
                                                         ▼
                                       Evaluation (exakt/genähert, Hinweise) → Stack, Verlauf, Display (<app-math>)
```

## 7. Abhängigkeiten

| Paket | Zweck | Lizenz | Begründung |
|---|---|---|---|
| `@angular/*` 22.2, `@angular/service-worker` | UI, PWA | MIT | Vorgabe |
| `@tauri-apps/api` 2.12, `@tauri-apps/plugin-dialog` 2.8 | IPC, Dateidialoge | MIT/Apache-2.0 | nur hinter Fassaden |
| `mathlive` 0.111.4 | Eingabe, statische Formeln | MIT | ADR 0003, lazy |
| `nerdamer` 2.0.1 | CAS | Apache-2.0 | ADR 0004, nur im Worker-Chunk |
| Rust: `tauri` 2.12, `tauri-plugin-dialog` 2.8, `tauri-plugin-window-state` 2.5, `serde`, `serde_json` | Desktop | MIT/Apache-2.0 | minimal |
| Dev: `@tauri-apps/cli`, ESLint/angular-eslint, Prettier, Vitest, jsdom, `fake-indexeddb` (Apache-2.0), `playwright` (Apache-2.0), `axe-core` (MPL-2.0), Rust `tempfile` | Werkzeuge, Tests | – | nicht im Produkt |

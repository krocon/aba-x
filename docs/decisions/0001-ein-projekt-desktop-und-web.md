# ADR 0001 – Ein Angular-Projekt für Desktop (Tauri 2) und Web

- Status: angenommen · Datum: 02.11.2026

## Kontext
ABA-X1 soll als Desktop-App (macOS, Windows, Linux) und als reine Webseite erscheinen (Master-Prompt §2.1).
Vorbild für Aufbau und Werkzeuge ist Files and Folders (FnF).

## Entscheidung
Ein Angular-22-Projekt im Repository-Root, `src-tauri/` daneben, kein Monorepo-Werkzeug. Zwei Build-Konfigurationen:
`production` → `dist/desktop` (für Tauri), `web` → `dist/web` (Service Worker, `base-href`). Plattformunterschiede
nur über injizierte Fassaden (`PlatformApi`, `StorageApi`, später `FilesApi`, `MenuApi`); die einzige Stelle, die
`isTauri()` fragt, ist `app.config.ts`.

## Folgen
+ Ein Code, eine Testsuite, identisches Verhalten. + Wie FnF: gleiche Befehle, gleiche Skripte.
− Web-Build trägt `@tauri-apps/api` mit (wenige kB). − Monorepo-Aufteilung später nötig, falls `src/math` als
npm-Paket erscheinen soll (vorbereitet durch die Import-Sperre, ADR 0002).

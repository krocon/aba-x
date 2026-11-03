# Feature-Prompts – ABA-X1

Arbeitsaufträge für die Weiterentwicklung, jeweils für **eine neue Claude-Sitzung** im Repo. Jeder Prompt führt in
Phasen vom Design über Kern-, Rust- und Frontend-Tests bis zur Ende-zu-Ende-Prüfung in **Desktop-App und Web-Build**
und hält nach dem Design an (Freigabe). Gemeinsame Regeln: [000-arbeitsweise.md](000-arbeitsweise.md).
Produktvision: [000-ABA-X1-Master-Prompt.md](000-ABA-X1-Master-Prompt.md), für den zweiten Rechner
[000-ABA-T1-Master-Prompt.md](000-ABA-T1-Master-Prompt.md). Vorbild: Files and Folders.

**So startet man einen Prompt:** neue Sitzung im Repo, dann z. B.
„Lies `prompts/000-arbeitsweise.md` und führe `prompts/003-expression-ast-parser.md` aus.“

**Erledigte Prompts** liegen unter [`done/`](done/) – Stand 02.11.2026: **alle 001–023**. 024 ist ebenfalls erledigt; offen sind
die Prompts 025–048 für den zweiten Rechner ABA-T1. Neue Aufträge bekommen die nächste freie Nummer (049 …).

## Reihenfolge

Tatsächliche Reihenfolge: 001 → 003 → 013 → 009 → 004 → 005 → 006 → 007 → 008 → 010 → 011 → 012 → 002 → 017 →
018 → 019 → 014 → 015 → 016 → 020 → 021 → 022 → 023. Die Nummern bleiben stabil, damit Verweise gültig bleiben.

| Nr. | Prompt                                                                             | Inhalt                                                                                   | Abhängig von  | Aufwand | Status        |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------- | ------- | ------------- |
| 001 | [walking-skeleton-tauri-web](done/001-walking-skeleton-tauri-web.md)               | Gerüst Desktop + Web, Fassaden, Gerät, Hardware-Tastatur                                 | –             | L       | ✅ 02.11.2026 |
| 002 | [plattform-fassaden](done/002-plattform-fassaden.md)                               | Dateien, Menü, Fensterzustand, About                                                     | 001           | M       | ✅ 02.11.2026 |
| 003 | [expression-ast-parser](done/003-expression-ast-parser.md)                         | AST, Text- und LaTeX-Parser, Serializer                                                  | 001           | L       | ✅ 02.11.2026 |
| 004 | [worker-protokoll](done/004-worker-protokoll.md)                                   | Web Worker, Abbruch, Timeout                                                             | 003           | M       | ✅ 02.11.2026 |
| 005 | [auswertung-standardmodus](done/005-auswertung-standardmodus.md)                   | ENTER rechnet: exakt/numerisch, Grad/Bogenmaß                                            | 003           | L       | ✅ 02.11.2026 |
| 006 | [natuerliche-ausgabe](done/006-natuerliche-ausgabe.md)                             | Lehrbuchdarstellung im Display, Stack-Navigation, Kopieren                               | 005           | M       | ✅ 02.11.2026 |
| 007 | [aktionssystem-tastatur](done/007-aktionssystem-tastatur.md)                       | Aktionskatalog, Keymaps je OS, Alpha-Modus                                               | 005           | M       | ✅ 02.11.2026 |
| 008 | [variablen-funktionen](done/008-variablen-funktionen.md)                           | Variablen, Funktionen, STO/RCL, VARS                                                     | 005, 007      | M       | ✅ 02.11.2026 |
| 009 | [cas-adapter-nerdamer](done/009-cas-adapter-nerdamer.md)                           | SymbolicEngine mit Nerdamer 2 im Worker                                                  | 003, 004      | L       | ✅ 02.11.2026 |
| 010 | [cas-modus-algebra-gleichungen](done/010-cas-modus-algebra-gleichungen.md)         | CAS-Modus: Vereinfachen, Faktorisieren, Lösen                                            | 009, 006      | M       | ✅ 02.11.2026 |
| 011 | [ableitungen](done/011-ableitungen.md)                                             | Ableitungen, Grenzwerte                                                                  | 009, 010      | S       | ✅ 02.11.2026 |
| 012 | [symbolische-integration](done/012-symbolische-integration.md)                     | Integrale exakt/numerisch                                                                | 009, 013      | M       | ✅ 02.11.2026 |
| 013 | [numerische-verfahren](done/013-numerische-verfahren.md)                           | Nullstellen, Ableitung, Quadratur                                                        | 003           | L       | ✅ 02.11.2026 |
| 014 | [funktionsplotter](done/014-funktionsplotter.md)                                   | Graph-Modus                                                                              | 005, 008, 013 | L       | ✅ 02.11.2026 |
| 015 | [nullstellen-extrema-schnittpunkte](done/015-nullstellen-extrema-schnittpunkte.md) | Analyse im Graph                                                                         | 014           | M       | ✅ 02.11.2026 |
| 016 | [integralflaechen](done/016-integralflaechen.md)                                   | Flächen im Graph                                                                         | 012, 015      | S       | ✅ 02.11.2026 |
| 017 | [verlauf-export-import](done/017-verlauf-export-import.md)                         | Verlauf, Favoriten, Export/Import                                                        | 002, 008      | M       | ✅ 02.11.2026 |
| 018 | [einstellungen-i18n](done/018-einstellungen-i18n.md)                               | SETUP, Deutsch/Englisch                                                                  | 007           | M       | ✅ 02.11.2026 |
| 019 | [menue-tastenkuerzel-je-os](done/019-menue-tastenkuerzel-je-os.md)                 | Menüleiste, Kürzel je OS                                                                 | 002, 007      | S       | ✅ 02.11.2026 |
| 020 | [pwa-offline-web-deployment](done/020-pwa-offline-web-deployment.md)               | PWA, Offline-E2E, Deployment vorbereiten                                                 | 005           | S       | ✅ 02.11.2026 |
| 021 | [barrierefreiheit](done/021-barrierefreiheit.md)                                   | Barrierefreiheit, Performance                                                            | 006, 007      | M       | ✅ 02.11.2026 |
| 022 | [release-distribution](done/022-release-distribution.md)                           | Pakete, Release-Workflow, Signierung vorbereiten                                         | 017, 019      | M       | ✅ 02.11.2026 |
| 023 | [readme-screenshots-werbeseite](done/023-readme-screenshots-werbeseite.md)         | README, Screenshots, Werbeseite                                                          | 010, 014      | S       | ✅ 02.11.2026 |
| 024 | [monorepo-mehrere-rechner](done/024-monorepo-mehrere-rechner.md)                   | Monorepo: `packages/math`, `packages/core`, `apps/aba-x1`; Grundlage für weitere Rechner | 001–023       | L       | ✅ 03.11.2026 |

## Zweiter Rechner: ABA-T1 (Vorbild HP Prime G2)

Arbeitsname ABA-T1 (Entscheidung in 025). Produktvision, Abgrenzung zum Vorbild (keine Marken, kein kopierter
Look, keine Handbuchtexte) und Funktionszuordnung: [000-ABA-T1-Master-Prompt.md](000-ABA-T1-Master-Prompt.md).
Empfohlene Reihenfolge: 025 → 026 → 027 → 028 → 029 → 030 → 031 → 032 → 033 → 034 → 035 → 037 → 039 → 043 → 044
→ 045, dann Soll (038, 036, 041, 042), Kann (040, 046, 047), zuletzt 048.

| Nr. | Prompt                                                                     | Inhalt                                                                        | Abhängig von | Aufwand | Umfang  | Status        |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------ | ------- | ------- | ------------- |
| 025 | [t1-produkt-geruest](done/025-t1-produkt-geruest.md)                       | Name, Logo, Bundle-ID, `apps/aba-t1`, `crates/shell`, leeres Gerät            | 024          | L       | Pflicht | ✅ 03.11.2026 |
| 026 | [t1-geraet-tastenfeld-touch](done/026-t1-geraet-tastenfeld-touch.md)       | Tastenfeld (Shift/Alpha), Wippe, Touch-Gesten, Dispatcher nach core           | 025          | L       | Pflicht | ✅ 03.11.2026 |
| 027 | [t1-startansicht](done/027-t1-startansicht.md)                             | Startansicht, Textbuch/Algebraisch, Verlauf, Vorlagen, Einstellungen, Komplex | 026          | L       | Pflicht | ✅ 03.11.2026 |
| 028 | [t1-rpn-modus](done/028-t1-rpn-modus.md)                                   | RPN-Stack in der Startansicht                                                 | 027          | M       | Pflicht | ✅ 03.11.2026 |
| 029 | [t1-cas-ansicht](done/029-t1-cas-ansicht.md)                               | CAS-Ansicht, CAS-Einstellungen, Engine-Entscheidung (Nerdamer/Giac)           | 027          | L       | Pflicht | ✅ 03.11.2026 |
| 030 | [t1-toolbox-katalog-hilfe](done/030-t1-toolbox-katalog-hilfe.md)           | Toolbox (Math/CAS/App/Nutzer/Katalog), Vars, Zeichen, Hilfe                   | 027, 029     | M       | Pflicht | ✅ 03.11.2026 |
| 031 | [t1-einheiten-konstanten-basen](done/031-t1-einheiten-konstanten-basen.md) | Einheiten, Konstanten (CODATA), Ganzzahl-Basen                                | 030          | M       | Pflicht | ✅ 03.11.2026 |
| 032 | [t1-listen-matrizen](done/032-t1-listen-matrizen.md)                       | Listen, Matrizen, Editoren, lineare Algebra                                   | 027, 030     | L       | Pflicht | ✅ 03.11.2026 |
| 033 | [t1-app-rahmen-bibliothek](done/033-t1-app-rahmen-bibliothek.md)           | App-Bibliothek, Symb/Plot/Num + Setup, App-Vertrag                            | 026, 027     | M       | Pflicht | ✅ 03.11.2026 |
| 034 | [t1-funktionen-app](done/034-t1-funktionen-app.md)                         | Funktionen-App mit FKT-Analyse, Zoom, Trace, Tabelle                          | 033          | L       | Pflicht | ✅ 03.11.2026 |
| 035 | [t1-parametrisch-polar-folge](done/035-t1-parametrisch-polar-folge.md)     | Parametrisch-, Polar-, Folge-App                                              | 034          | M       | Pflicht | ✅ 03.11.2026 |
| 036 | [t1-erweiterte-grafiken](done/036-t1-erweiterte-grafiken.md)               | Relationen/Ungleichungen, Intervallarithmetik                                 | 034          | L       | Soll    | ✅ 03.11.2026 |
| 037 | [t1-statistik-1var-2var](037-t1-statistik-1var-2var.md)                    | Statistik 1 Var/2 Var, Diagramme, Regression                                  | 032, 033     | L       | Pflicht | offen         |
| 038 | [t1-inferenz-verteilungen](038-t1-inferenz-verteilungen.md)                | Verteilungen, Hypothesentests, Konfidenzintervalle                            | 037          | M       | Soll    | offen         |
| 039 | [t1-loeser-apps](done/039-t1-loeser-apps.md)                               | Lösen, Linearlöser, Finanzen, Dreiecklöser                                    | 032, 033     | L       | Pflicht | ✅ 03.11.2026 |
| 040 | [t1-explorer-apps](done/040-t1-explorer-apps.md)                           | Linear-/Quadratisch-/Trig-Explorer mit Übungsmodus                            | 034          | S       | Kann    | ✅ 03.11.2026 |
| 041 | [t1-spreadsheet](041-t1-spreadsheet.md)                                    | Tabellenkalkulation mit Formeln, Namen, CAS-Zellen                            | 032, 033     | L       | Soll    | offen         |
| 042 | [t1-geometrie](042-t1-geometrie.md)                                        | Dynamische Geometrie (042a/042b)                                              | 033, 034     | XL      | Soll    | offen         |
| 043 | [t1-programmiersprache-kern](043-t1-programmiersprache-kern.md)            | PPL-artige Sprache: `packages/ppl`, Interpreter im Worker                     | 027, 032     | L       | Pflicht | offen         |
| 044 | [t1-programm-editor-eigene-apps](044-t1-programm-editor-eigene-apps.md)    | Programmkatalog, Editor, Debugger, eigene Apps, Nutzer-Tasten                 | 043, 033     | M       | Pflicht | offen         |
| 045 | [t1-notizen-speicher-backup](done/045-t1-notizen-speicher-backup.md)       | Notizen, Info, Speicherverwaltung, Backup, Menü                               | 033          | M       | Pflicht | ✅ 03.11.2026 |
| 046 | [t1-3d-grafiken](done/046-t1-3d-grafiken.md)                               | 3D-Flächen (WebGL)                                                            | 034          | M       | Kann    | ✅ 03.11.2026 |
| 047 | [t1-python-app](047-t1-python-app.md)                                      | Python (MicroPython/WASM)                                                     | 044          | M       | Kann    | offen         |
| 048 | [t1-produktreife-release](048-t1-produktreife-release.md)                  | Barrierefreiheit, i18n, PWA, E2E, Release, README, Werbeseite                 | 025–045      | M       | Pflicht | offen         |

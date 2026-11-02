# Feature-Prompts – ABA-X1

Arbeitsaufträge für die Weiterentwicklung, jeweils für **eine neue Claude-Sitzung** im Repo. Jeder Prompt führt in
Phasen vom Design über Kern-, Rust- und Frontend-Tests bis zur Ende-zu-Ende-Prüfung in **Desktop-App und Web-Build**
und hält nach dem Design an (Freigabe). Gemeinsame Regeln: [000-arbeitsweise.md](000-arbeitsweise.md).
Produktvision: [000-ABA-X1-Master-Prompt.md](000-ABA-X1-Master-Prompt.md). Vorbild: Files and Folders.

**So startet man einen Prompt:** neue Sitzung im Repo, dann z. B.
„Lies `prompts/000-arbeitsweise.md` und führe `prompts/003-expression-ast-parser.md` aus.“

**Erledigte Prompts** liegen unter [`done/`](done/) – Stand 02.11.2026: **alle 001–023**. Neue Aufträge bekommen die
nächste freie Nummer (024 …).

## Reihenfolge

Tatsächliche Reihenfolge: 001 → 003 → 013 → 009 → 004 → 005 → 006 → 007 → 008 → 010 → 011 → 012 → 002 → 017 →
018 → 019 → 014 → 015 → 016 → 020 → 021 → 022 → 023. Die Nummern bleiben stabil, damit Verweise gültig bleiben.

| Nr. | Prompt | Inhalt | Abhängig von | Aufwand | Status |
|---|---|---|---|---|---|
| 001 | [walking-skeleton-tauri-web](done/001-walking-skeleton-tauri-web.md) | Gerüst Desktop + Web, Fassaden, Gerät, Hardware-Tastatur | – | L | ✅ 02.11.2026 |
| 002 | [plattform-fassaden](done/002-plattform-fassaden.md) | Dateien, Menü, Fensterzustand, About | 001 | M | ✅ 02.11.2026 |
| 003 | [expression-ast-parser](done/003-expression-ast-parser.md) | AST, Text- und LaTeX-Parser, Serializer | 001 | L | ✅ 02.11.2026 |
| 004 | [worker-protokoll](done/004-worker-protokoll.md) | Web Worker, Abbruch, Timeout | 003 | M | ✅ 02.11.2026 |
| 005 | [auswertung-standardmodus](done/005-auswertung-standardmodus.md) | ENTER rechnet: exakt/numerisch, Grad/Bogenmaß | 003 | L | ✅ 02.11.2026 |
| 006 | [natuerliche-ausgabe](done/006-natuerliche-ausgabe.md) | Lehrbuchdarstellung im Display, Stack-Navigation, Kopieren | 005 | M | ✅ 02.11.2026 |
| 007 | [aktionssystem-tastatur](done/007-aktionssystem-tastatur.md) | Aktionskatalog, Keymaps je OS, Alpha-Modus | 005 | M | ✅ 02.11.2026 |
| 008 | [variablen-funktionen](done/008-variablen-funktionen.md) | Variablen, Funktionen, STO/RCL, VARS | 005, 007 | M | ✅ 02.11.2026 |
| 009 | [cas-adapter-nerdamer](done/009-cas-adapter-nerdamer.md) | SymbolicEngine mit Nerdamer 2 im Worker | 003, 004 | L | ✅ 02.11.2026 |
| 010 | [cas-modus-algebra-gleichungen](done/010-cas-modus-algebra-gleichungen.md) | CAS-Modus: Vereinfachen, Faktorisieren, Lösen | 009, 006 | M | ✅ 02.11.2026 |
| 011 | [ableitungen](done/011-ableitungen.md) | Ableitungen, Grenzwerte | 009, 010 | S | ✅ 02.11.2026 |
| 012 | [symbolische-integration](done/012-symbolische-integration.md) | Integrale exakt/numerisch | 009, 013 | M | ✅ 02.11.2026 |
| 013 | [numerische-verfahren](done/013-numerische-verfahren.md) | Nullstellen, Ableitung, Quadratur | 003 | L | ✅ 02.11.2026 |
| 014 | [funktionsplotter](done/014-funktionsplotter.md) | Graph-Modus | 005, 008, 013 | L | ✅ 02.11.2026 |
| 015 | [nullstellen-extrema-schnittpunkte](done/015-nullstellen-extrema-schnittpunkte.md) | Analyse im Graph | 014 | M | ✅ 02.11.2026 |
| 016 | [integralflaechen](done/016-integralflaechen.md) | Flächen im Graph | 012, 015 | S | ✅ 02.11.2026 |
| 017 | [verlauf-export-import](done/017-verlauf-export-import.md) | Verlauf, Favoriten, Export/Import | 002, 008 | M | ✅ 02.11.2026 |
| 018 | [einstellungen-i18n](done/018-einstellungen-i18n.md) | SETUP, Deutsch/Englisch | 007 | M | ✅ 02.11.2026 |
| 019 | [menue-tastenkuerzel-je-os](done/019-menue-tastenkuerzel-je-os.md) | Menüleiste, Kürzel je OS | 002, 007 | S | ✅ 02.11.2026 |
| 020 | [pwa-offline-web-deployment](done/020-pwa-offline-web-deployment.md) | PWA, Offline-E2E, Deployment vorbereiten | 005 | S | ✅ 02.11.2026 |
| 021 | [barrierefreiheit](done/021-barrierefreiheit.md) | Barrierefreiheit, Performance | 006, 007 | M | ✅ 02.11.2026 |
| 022 | [release-distribution](done/022-release-distribution.md) | Pakete, Release-Workflow, Signierung vorbereiten | 017, 019 | M | ✅ 02.11.2026 |
| 023 | [readme-screenshots-werbeseite](done/023-readme-screenshots-werbeseite.md) | README, Screenshots, Werbeseite | 010, 014 | S | ✅ 02.11.2026 |

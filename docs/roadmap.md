# Roadmap – ABA-X1

> Phasen aus dem Master-Prompt §7, umgesetzt über die Feature-Prompts in `prompts/` (Index:
> [`prompts/README.md`](../prompts/README.md)). Status: ✅ fertig · 🟡 teilweise · ⬜ offen.

| Phase | Inhalt                                                                         | Prompts       | Status                                                                                   |
| ----- | ------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------- |
| 0     | Repository-Analyse, technische Validierung, Architektur                        | Master-Prompt | ✅ 02.11.2026                                                                            |
| 1     | Walking Skeleton Desktop + Web, Geräte-Look, Hardware-Tastatur                 | 001           | ✅ 02.11.2026                                                                            |
| 2     | Mathematischer Kern: AST, Parser, Worker                                       | 003, 004      | ✅ 02.11.2026                                                                            |
| 3     | Rechner und natürliche Darstellung                                             | 005–008       | ✅ 02.11.2026                                                                            |
| 4     | Symbolisches Rechnen                                                           | 009–012       | ✅ 02.11.2026                                                                            |
| 5     | Numerische Mathematik                                                          | 013           | ✅ 02.11.2026                                                                            |
| 6     | Graph-Modus                                                                    | 014–016       | ✅ 02.11.2026                                                                            |
| 7     | Plattform-Integration, Produktreife                                            | 002, 017–021  | ✅ 02.11.2026                                                                            |
| 8     | Distribution                                                                   | 022, 023      | 🟡 vorbereitet – Veröffentlichung, Signierung und Web-Deployment brauchen Marcs Freigabe |
| 9     | Monorepo für mehrere Rechner (`packages/math`, `packages/core`, `apps/aba-x1`) | 024           | ✅ 03.11.2026                                                                            |
| 10    | Zweiter Rechner ABA-T1 (Bedienkonzept HP Prime G2)                             | 025–048       | 🟡 in Arbeit                                                                             |

### ABA-T1

| Prompt | Inhalt                                                                                                      | Status        |
| ------ | ----------------------------------------------------------------------------------------------------------- | ------------- |
| 025    | Identität, App-Gerüst, `crates/shell` (ADR 0008)                                                            | ✅ 03.11.2026 |
| 026    | Tastenfeld, Shift/Alpha, Wippe, Gesten, PC-Tastatur; Chords/Dispatcher/Gesten in `@aba/core`                | ✅ 03.11.2026 |
| 027    | Startansicht (Lehrbuch/Algebraisch), komplexe Zahlen, Zahlenformate, Variablen, Einstellungen               | ✅ 03.11.2026 |
| 028    | RPN-Stack (PICK, ROLL, ROLLD, DROPN, ECHO, SWAP, DUP, DROP)                                                 | ✅ 03.11.2026 |
| 029    | CAS-Ansicht: Nerdamer + eigene Verfahren (Ganzzahl, Taylor), Lücken-Tabelle                                 | ✅ 03.11.2026 |
| 030    | Toolbox (Math/CAS/App/Nutzer/Katalog), Vars, Zeichen, Hilfe DE/EN                                           | ✅ 03.11.2026 |
| 031    | Einheiten (≈ 85, Präfixe, Temperaturen), Konstanten CODATA 2022, Basis-Ganzzahlen                           | ✅ 03.11.2026 |
| 032    | Listen, Matrizen, lineare Algebra (LU, RREF, Eigenwerte), Katalog + Tabelleneditor                          | ✅ 03.11.2026 |
| 033    | App-Rahmen (Bibliothek, Symb/Plot/Num/Setups/Info, Kopien), PlotCanvas in `@aba/core`                       | ✅ 03.11.2026 |
| 034    | Funktionen-App: Trace, Zoom-Menü, Fcn-Analyse, Gehe zu, geteilte Ansicht, PNG, Plot-Optionen                | ✅ 03.11.2026 |
| 035    | Parametrisch, Polar, Folge (Treppe/Spinnennetz) als generische Kurven-App                                   | ✅ 03.11.2026 |
| 040    | Explorer: linear, quadratisch, trigonometrisch mit Übungsmodus                                              | ✅ 03.11.2026 |
| 036    | Erweiterte Grafiken: Relationen/Ungleichungen mit Intervallarithmetik (garantierte Gebiete), Trace, Galerie | ✅ 03.11.2026 |
| 042    | Geometrie: dynamische Konstruktionen (Werkzeuge, Ziehen, Kegelschnitte, Abbildungen, Ortslinie), Messen/Tests | ✅ 03.11.2026 |
| 046    | 3D-Grafik (Canvas 2D, Drehen/Zoomen, Höhenfarben)                                                           | ✅ 03.11.2026 |
| 045    | Notizen, Speicherverwaltung, Sicherung (Export/Import), Menü nativ/HTML, About                              | ✅ 03.11.2026 |

## Was funktioniert

Siehe README „Features“. Kurz: exaktes und numerisches Rechnen mit Stack/RPN, Variablen und Funktionen, CAS mit
numerisch geprüften Ergebnissen, Funktionsplotter mit Analyse, Verlauf, Export/Import, Einstellungen, Deutsch/
Englisch, natives Menü (Desktop) bzw. HTML-Menü (Web), Offline-Web-App.

Geprüft (Stand 024): 343 Unit-/Komponenten-Specs (265 `@aba/math` + 78 `ng test`), 27 Skript-Tests, 12 Rust-Tests, E2E in Chromium und WebKit (inkl. offline und axe), macOS-App
(Debug und Release, `.dmg` 3,9 MB).

## Offen / nächste Schritte

- **Freigaben (Marc):** Push, CI-Lauf auf Windows/Linux, erstes Release (Signierung), Hochladen nach
  https://krocon.de/products/aba-x1/ (Build ist darauf eingestellt) – `docs/release.md`, `docs/deployment.md`.
- **Nicht von Hand geprüft:** Windows, Linux (CI-Matrix vorhanden), Firefox (Playwright startet hier nicht),
  Screenreader-Durchgang (VoiceOver/NVDA/Orca).
- Meldungen des Mathe-Kerns sind englisch, auch in der deutschen Oberfläche.
- **Zweiter Rechner (025 ff.):** offene Punkte aus 024 – gemeinsame Rust-Crate `crates/shell`, Laufzeit-Abhängigkeiten
  je App (Notices), eigenes Testziel für `packages/core`, Herauslösen von Graph-View, Aktionssystem, Menü-Fassade nach
  Bedarf, e2e-Szenarien und Screenshots je App (ADR 0007).
- Ausbaustufen laut Master-Prompt §11 und §3.1: komplexe Zahlen, Matrizenrechnung, Ungleichungen, Programmierung,
  Statistik, 3D, Auto-Updater, Mobile-Apps.

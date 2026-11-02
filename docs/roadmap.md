# Roadmap – ABA-X1

> Phasen aus dem Master-Prompt §7, umgesetzt über die Feature-Prompts in `prompts/` (Index:
> [`prompts/README.md`](../prompts/README.md)). Status: ✅ fertig · 🟡 teilweise · ⬜ offen.

| Phase | Inhalt | Prompts | Status |
|---|---|---|---|
| 0 | Repository-Analyse, technische Validierung, Architektur | Master-Prompt | ✅ 02.11.2026 |
| 1 | Walking Skeleton Desktop + Web, Geräte-Look, Hardware-Tastatur | 001 | ✅ 02.11.2026 |
| 2 | Mathematischer Kern: AST, Parser, Worker | 003, 004 | ✅ 02.11.2026 |
| 3 | Rechner und natürliche Darstellung | 005–008 | ✅ 02.11.2026 |
| 4 | Symbolisches Rechnen | 009–012 | ✅ 02.11.2026 |
| 5 | Numerische Mathematik | 013 | ✅ 02.11.2026 |
| 6 | Graph-Modus | 014–016 | ✅ 02.11.2026 |
| 7 | Plattform-Integration, Produktreife | 002, 017–021 | ✅ 02.11.2026 |
| 8 | Distribution | 022, 023 | 🟡 vorbereitet – Veröffentlichung, Signierung und Web-Deployment brauchen Marcs Freigabe |

## Was funktioniert

Siehe README „Features“. Kurz: exaktes und numerisches Rechnen mit Stack/RPN, Variablen und Funktionen, CAS mit
numerisch geprüften Ergebnissen, Funktionsplotter mit Analyse, Verlauf, Export/Import, Einstellungen, Deutsch/
Englisch, natives Menü (Desktop) bzw. HTML-Menü (Web), Offline-Web-App.

Geprüft: 341 Unit-/Komponenten-Specs, 12 Rust-Tests, E2E in Chromium und WebKit (inkl. offline und axe), macOS-App
(Debug und Release, `.dmg` 3,9 MB).

## Offen / nächste Schritte

- **Freigaben (Marc):** Push, CI-Lauf auf Windows/Linux, erstes Release (Signierung), Hochladen nach
  https://krocon.de/products/aba-x1/ (Build ist darauf eingestellt) – `docs/release.md`, `docs/deployment.md`.
- **Nicht von Hand geprüft:** Windows, Linux (CI-Matrix vorhanden), Firefox (Playwright startet hier nicht),
  Screenreader-Durchgang (VoiceOver/NVDA/Orca).
- Meldungen des Mathe-Kerns sind englisch, auch in der deutschen Oberfläche.
- Ausbaustufen laut Master-Prompt §11 und §3.1: komplexe Zahlen, Matrizenrechnung, Ungleichungen, Programmierung,
  Statistik, 3D, Auto-Updater, Mobile-Apps.

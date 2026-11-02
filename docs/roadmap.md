# Roadmap – ABA-X1

> Phasen aus dem Master-Prompt §7, umgesetzt über die Feature-Prompts in `prompts/` (Index:
> [`prompts/README.md`](../prompts/README.md)). Status: ✅ fertig · 🟡 teilweise · ⬜ offen.

| Phase | Inhalt | Prompts | Status |
|---|---|---|---|
| 0 | Repository-Analyse, technische Validierung, Architektur | Master-Prompt | ✅ 02.11.2026 – `docs/technical-evaluation.md`, `docs/decisions/` |
| 1 | Walking Skeleton Desktop + Web | 001 | ✅ 02.11.2026 – App startet als `ABA-X1.app` und als PWA, `pnpm check` grün |
| – | Geräte-Look + Hardware-Tastatur (Vorgabe Marc) | 001 (Nachtrag) | ✅ 02.11.2026 – ADR 0006 |
| 2 | Mathematischer Kern: AST, Parser, Worker | 002–004 | 🟡 `MathResult` steht; 002 offen (Fassaden für Dateien/Menü), 003, 004 offen |
| 3 | Rechner und natürliche Darstellung | 005–008 | 🟡 Eingabe, Stack, Tastenfeld ohne Auswertung; 005–008 offen |
| 4 | Symbolisches Rechnen | 009–012 | ⬜ |
| 5 | Numerische Mathematik | 013 | ⬜ |
| 6 | Graph-Modus | 014–016 | ⬜ |
| 7 | Plattform-Integration, Produktreife | 017–021 | ⬜ |
| 8 | Distribution | 022–023 | ⬜ |

## Was heute funktioniert

- Desktop-App (macOS geprüft) und Web-Build (Chromium geprüft, offline per Service Worker) aus demselben Code.
- Rechner-Gerät: LCD mit Stack 4…1, MathLive-Eingabezeile mit natürlicher Darstellung, Softkeys F1–F6 für die Modi
  Standard/CAS/Graph, Tastenfeld mit Links-/Rechts-Shift, Hardware-Tastatur (Tippen, Enter, Esc, F1–F6).
- ENTER legt den eingegebenen **Ausdruck** auf den Stack; DROP, SWAP, RECALL, UNDO/REDO.
- Der gewählte Modus bleibt über einen Neustart erhalten (Desktop: JSON-Datei, Web: IndexedDB).

## Was noch nicht funktioniert

- **Es wird noch nichts ausgerechnet** – Parser und Auswertung folgen mit 003/005.
- CAS- und Graph-Modus sind Platzhalter; VARS/HIST/SETUP und STO/RCL/SOLVE melden „not available yet“.
- Windows und Linux sind nicht von Hand geprüft (CI-Matrix vorbereitet).
- Keine Pakete/Releases, kein Web-Deployment (vorbereitet, Freigabe nötig).

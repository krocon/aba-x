# Prompt 000: Gemeinsame Arbeitsweise für alle Feature-Prompts

> Gilt für alle Prompts in `prompts/` (Index und Reihenfolge: `prompts/README.md`). Jeder Feature-Prompt verweist
> hierher und beschreibt nur, was für sein Feature dazukommt. **Zuerst diese Datei lesen, dann den Feature-Prompt.**
> Bei Widersprüchen gilt diese Datei, außer der Feature-Prompt weicht ausdrücklich ab. Übernommen aus Files and
> Folders (`../files-and-folders-tauri/prompts/000-arbeitsweise.md`) und an ABA-X1 angepasst.

---

## 1. Vor dem Start

- `CLAUDE.md` vollständig lesen, dazu `docs/architecture.md`, `docs/roadmap.md`, die im Prompt genannten ADRs
  (`docs/decisions/`) und Abschnitte aus `docs/technical-evaluation.md`. Produktvision:
  `prompts/000-ABA-X1-Master-Prompt.md`.
- **Abhängigkeiten prüfen:** Jeder Prompt nennt oben, welche Prompts vorher umgesetzt sein sollten
  (`prompts/README.md` → Status). Fehlt etwas: anhalten und fragen.
- Prüfen, ob es schon einen Stand gibt (Branch `feat/<slug>`, Design-Dokument, abgehakte Definition of Done).
- Toolchain prüfen (`node -v` ≥ 22.22.3, `pnpm -v`, `cargo -V`), `pnpm install`, einmal `pnpm check` – rote Checks
  vor dem Start sind ein eigener Befund, nicht stillschweigend „mitreparieren“.
- Branch **`feat/<slug>`** von `main`. Commits nach jeder grünen Phase (Conventional Commits). **Kein Push, kein
  Release, kein Deployment, kein Force-Push** ohne ausdrückliche Anweisung.
- Taskliste mit einem Eintrag je Phase führen.

## 2. Phasen

| Phase | Ergebnis                                                                           | Haltepunkt           |
| ----- | ---------------------------------------------------------------------------------- | -------------------- |
| 1     | Design-Dokument `prompts/NNN-<slug>.design.md`                                     | 🛑 Freigabe abwarten |
| 2     | Mathematik-Kern (`packages/math`): Specs zuerst (rot), dann Implementierung (grün) | Commit               |
| 3     | Rust (nur wenn nötig): Specs zuerst, dann Implementierung                          | Commit               |
| 4     | Frontend: Specs zuerst, dann Implementierung                                       | Commit               |
| 5     | Ende-zu-Ende in der **Desktop-App und im Web-Build**                               |                      |
| 6     | Doku                                                                               | Commit               |
| 7     | Abschlussprüfung + Bericht                                                         |                      |

Kleine Features dürfen Phasen zusammenlegen (in Phase 1 entscheiden und im Design-Dokument festhalten). Reine
UI-Features lassen Phase 2/3 aus, reine Kern-Features Phase 3.

### Phase 1 – Bestand prüfen und entwerfen 🛑

- Die im Prompt genannten Code-Stellen lesen. Tabelle „Baustein → wofür → passt / fehlt / muss erweitert werden“.
- Für jede Entscheidungsfrage im Prompt: Optionen, Empfehlung, Begründung.
- **Verträge zuerst:** TypeScript-Interfaces des Kerns, ggf. Rust-Commands (Name, Parameter, Rückgabe, Fehlercodes),
  Worker-Nachrichten; Tasten/Softkeys und Tastenkürzel je OS; UI-Skizze (ASCII reicht) mit Fokus und ARIA-Rollen.
- **Mathematische Korrektheit planen:** Referenzfälle (Master-Prompt §6.2), Property-Tests (§6.3), Fehlerfälle
  (§6.4); welche Fälle der Adapter ablehnen muss, statt etwas Falsches zu liefern.
- Tests planen: Kern (Vitest, ohne DOM), Rust, Frontend, nur Ende-zu-Ende.
- Ergebnis als `prompts/NNN-<slug>.design.md` (Kopf: Status, Datum, Entscheidungen; unten Abschnitt „Fortschritt“
  für Sitzungswechsel). **Danach anhalten** und bestätigen lassen.

### Phase 2 – Mathematik-Kern

- Nur `packages/math/`: keine Importe aus Angular, Tauri, MathLive, `@aba/core` oder `apps/` (ESLint sperrt das).
- Fehler sind Werte (`MathResult`), keine Exceptions über die Kerngrenze; nie ein geratenes Ergebnis.
- Fallkataloge als `*.cases.json` mit tabellarischen Specs; Vergleich symbolischer Ergebnisse über Normalform,
  Einsetzen oder Ableiten (CAS-Ausgaben dürfen äquivalent, aber textuell verschieden sein).
- Numerik: Grenzfälle (Division durch null, Singularität, Unstetigkeit, keine Konvergenz, Über-/Unterlauf, leeres
  Intervall) jeweils mit eigenem Test.

### Phase 3 – Rust

- Logik in reinen Modulen ohne Tauri (`tempfile`-Tests), Command-Schicht dünn (`commands.rs`).
- Blockierendes über `spawn_blocking`; Fehler als `AppError { code, message }`; keine Pfade aus dem Frontend ohne
  Prüfung; Plattformspezifisches mit `#[cfg(...)]`.
- `pnpm rust:fmt`, `pnpm rust:lint`, `pnpm rust:test` grün → Commit.

### Phase 4 – Frontend

- Plattform nur über Fassaden (`packages/core/src/*/*-api.ts`, `@aba/core/…`) mit Web- und Tauri-Implementierung und
  Fake in `packages/core/testing/`. App-Spezifisches bleibt in `apps/<app>/` (ADR 0007).
- Zustand mit Signals in Stores, reine Logik in `*-logic.ts`, `OnPush`, zoneless.
- Tastatur: Hardware-Tastatur und virtuelles Tastenfeld gleichwertig; Kürzel zentral (ab Prompt 007 im
  Aktionssystem); Tasten nehmen der Eingabezeile nie den Fokus.
- **Barrierefreiheit:** sichtbarer Fokus, jede Funktion per Tastatur, `aria-label` an Symbol-Tasten, Dialoge mit
  `role="dialog"`/`aria-modal`, Fokusfalle und Rückgabe, Live-Region für Meldungen und Ergebnisse, Kontraste.
- Texte zentral (ab Prompt 018 übersetzt). Nutzereingaben nie unescaped in `innerHTML` (Formeln über `<math-span>`
  mit Text-Bindung).
- Gerät: Display mit fester Größe; Gerätefarben nur als `--dev-*`/`--lcd-*`-Tokens.
- `pnpm format:check`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm build:web` grün → Commit.

### Phase 5 – Ende-zu-Ende

- **Web:** `pnpm build:web`, statisch ausliefern (`.claude/launch.json` → `web-dist`), im Browser jedes
  Akzeptanzkriterium durchspielen, auch bei 375 px Breite und in hell/dunkel; Service Worker vorher abmelden.
- **Desktop:** `pnpm tauri dev` oder `pnpm tauri build --debug --bundles app` und dieselben Kriterien in der App.
- Nicht Prüfbares (z. B. Windows/Linux auf einem Mac) im Bericht ausdrücklich nennen.

### Phase 6 – Doku

- `docs/architecture.md` (Entscheidungen, neue Abhängigkeiten mit Lizenz und Größe), ggf. neues ADR,
  `docs/roadmap.md` (Status, „Was funktioniert“), README (Funktionen, Tastenkürzel), `CLAUDE.md` bei neuen Regeln,
  Befehlen oder Layout.
- Nach Abhängigkeitsänderungen `pnpm notices`.
- Im Index `prompts/README.md` den Status abhaken; Design-Dokument „Fortschritt“ abschließen.
- **Fertige Prompts nach `prompts/done/` verschieben** (Auftrag und `*.design.md`; `git mv`, Links im Index
  anpassen) – in `prompts/` liegen nur offene Prompts.

### Phase 7 – Abschlussprüfung

```bash
pnpm check
pnpm tauri build --debug --no-bundle
```

Danach Ende-zu-Ende-Durchlauf (Phase 5) wiederholen. Bei CAS, Numerik und Persistenz: Review durch einen separaten
Agenten, der den Code nicht geschrieben hat (Schwerpunkte nennt der Feature-Prompt).

**Abschlussbericht** (kurz, konkret): Was wurde geändert? Welche Dateien? Welche Befehle liefen tatsächlich?
Welche Checks grün? Auf welchen Plattformen geprüft (Browser, macOS, Windows, Linux) – und welche nicht? Bekannte
Einschränkungen? Nächster Schritt? Commits (Hash + Titel).

## 3. Definition of Done (zusätzlich zu der des Feature-Prompts)

- [ ] Design-Dokument freigegeben 🛑
- [ ] Specs grün, `pnpm check` grün, Debug-Build der App gebaut
- [ ] Akzeptanzkriterien Ende-zu-Ende in Desktop-App **und** Web-Build geprüft
- [ ] Tastatur (Hardware und virtuell) und Fokus geprüft, 375 px und hell/dunkel angesehen
- [ ] Keine erfundenen mathematischen Ergebnisse: Grenz- und Fehlerfälle getestet
- [ ] Doku aktuell, Prompt-Status abgehakt, Prompt nach `done/`
- [ ] Commits auf `feat/<slug>`, kein Push/Release/Deployment ohne Anweisung

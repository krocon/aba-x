# Prompt 007: Aktionssystem, Tastenkürzel je OS, Alpha-Modus

> **Abhängigkeiten:** 005 · **Aufwand:** M · **Betrifft:** Frontend (Desktop + Web)
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/aktionssystem-tastatur`. Design-Dokument: `prompts/007-aktionssystem-tastatur.design.md`.

## 1. Ziel

Alle Tasten, Softkeys und Kürzel laufen über ein zentrales Aktionssystem (wie FnF 002): Aktionskatalog, Keymaps je OS (Cmd/Ctrl), keine verstreuten `keydown`-Handler. Alpha-Modus tippt Buchstaben über das Tastenfeld; Tastenkürzel-Übersicht.

## 2. Architektur und Bezug

- Vorbild FnF `src/app/core/actions/` (Aktionskatalog, Keymaps je OS, KeyboardDispatcher)
- Heute: `CalculatorDevice.onKeydown`, `keypad-model.ts` (`keyIdForPhysical`), `MathInput.onKeydown`

## 3. Umsetzung

1. Aktionskatalog (Id, Titel, Ausführung), Keymaps `mac.json`/`default.json`, Dispatcher; Konflikte mit Browser-/OS-Kürzeln prüfen (Web: nichts überschreiben, was der Browser braucht).
2. Tastenfeld und Softkeys rufen Aktionen auf; Shift/Alpha als Zustände.
3. Alpha-Modus (α, Doppel-α = Feststellen), Buchstaben A–Z laut Tastenbeschriftung.
4. Hilfe-Overlay „Tastenkürzel“ (Taste `?` oder Menü).

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Kürzel-Overrides durch Nutzer?** erst später (wie FnF Keymap-Override)?

## 4. Erwartete Dateien und Schnittstellen

- `src/app/core/actions/*`, `keymaps/*.json`
- Umbau `keypad-model.ts` → Aktions-Ids

## 5. Tests und Abnahmekriterien

**Tests**

- Keymap-Auflösung je OS
- Dispatcher ignoriert Eingaben in fremden Feldern
- Alpha-Folgen

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Alle bisherigen Kürzel funktionieren unverändert (Enter, Esc, F1–F6, Tippen)
- Alpha: α, A → `A` in der Zeile
- Übersicht zeigt Kürzel passend zum OS

## 6. Ausdrücklich nicht Teil dieses Prompts

- Neue Rechenfunktionen

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen
- README „Keyboard“

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

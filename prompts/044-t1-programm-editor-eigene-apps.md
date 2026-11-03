# Prompt 044: ABA-T1 – Programmkatalog, Editor, Debugger und eigene Apps

> **Abhängigkeiten:** 043, 033 · **Aufwand:** M · **Betrifft:** Frontend, `@aba/ppl`
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-programm-editor`. Design-Dokument: `prompts/044-t1-programm-editor-eigene-apps.design.md`.

## 1. Ziel

- **Programmkatalog** (Shift+1): Programme anlegen, umbenennen, kopieren, löschen, senden/exportieren, ausführen.
- **Editor:** Syntaxhervorhebung, Einrückung, Vorlagen-Menüs der Menüleiste (`Vorlage`, `Befehle`: Block, Verzweigung,
  Schleife, Variable, Funktion, Zeichenkette, Grafik, E/A …), **Prüfen** (Syntaxfehler mit Sprung zur Zeile),
  Suchen/Ersetzen, Hardware-Tastatur voll nutzbar (Desktop!), Touch-freundlich auf kleinen Displays.
- **Ausführen/Debuggen:** Start mit Argumenten (Formular), Einzelschritt, Haltepunkte, Variablen beobachten,
  Terminal (Shift+On-Äquivalent zum Anzeigen).
- **Eigene Apps:** App kopieren (033) + Programm mit `START`, `RESET`, `Symb`/`Plot`/`Num`-Überschreibungen und
  eigenen Ansichten (`VIEW`), eigene Menüleisten.
- **Nutzer-Tastenbelegung:** Shift+Help (User) – Tasten mit eigenen Programmen belegen (`KEY K_…()`), Nutzer-Modus
  einmalig/gesperrt.

## 2. Architektur und Bezug

- Vorbild Kap. 29 (Programmkatalog, Editor, Debuggen, App-Programme, Benutzertasten).
- Editor-Komponente: eigene leichte Lösung vs. CodeMirror 6 (MIT, modular) – entscheiden (Größe, Barrierefreiheit,
  Touch).

## 3. Umsetzung

1. Katalog + Persistenz (Programme als versionierte Dokumente, Export als Textdatei über `FilesApi`).
2. Editor mit Sprachunterstützung (Tokenizer aus `@aba/ppl` wiederverwenden).
3. Debugger-Protokoll im Interpreter (Haltepunkte, Schritt, Variablen-Snapshot).
4. App-Programme: Hooks im App-Vertrag (033); Nutzer-Tastenbelegung im Aktionssystem (026).

### Entscheidungsfragen (im Design-Dokument beantworten)

- Editor-Bibliothek; Debugger-Granularität (Anweisung vs. Zeile).
- Sicherheit: Programme aus Dateien sind Code – Ausführung nur im Worker, kein DOM-Zugriff, Budget.

## 4. Erwartete Dateien und Schnittstellen

- `apps/aba-t1/src/app/features/programs/{catalog,editor,debugger,terminal}/*`
- `packages/ppl/src/debug.ts`; App-Vertrag-Erweiterung; Keymap „Nutzer“

## 5. Tests und Abnahmekriterien

**Tests**

- Katalog-Operationen, Editor-Logik (Einrückung, Vorlagen), Debugger (Haltepunkt hält an der richtigen Stelle),
  Nutzer-Tastenbelegung.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Programm schreiben (Hardware-Tastatur und virtuell), Syntaxfehler finden, ausführen, im Debugger durchgehen;
  eigene App mit START-Programm aus der Bibliothek starten; Taste mit Programm belegen.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Import von Original-Programmdateien (`.hpprgm`); Python (047).

## 7. Doku

- `docs/ppl/` (Editor, Debugger, eigene Apps), Hilfe, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7

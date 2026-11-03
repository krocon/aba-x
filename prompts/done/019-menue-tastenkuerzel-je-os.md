# Prompt 019: Menüleiste und Kürzel je Betriebssystem

> **Abhängigkeiten:** 002, 007 · **Aufwand:** S · **Betrifft:** Desktop + Web
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/menue-tastenkuerzel-je-os`. Design-Dokument: `prompts/019-menue-tastenkuerzel-je-os.design.md`.

## 1. Ziel

Alle Befehle (Export, Import, Kopieren, Modi, Einstellungen, Hilfe, About) im nativen Menü (Desktop) bzw. HTML-Menü (Web) mit den OS-üblichen Kürzeln; Hilfe-Seite mit Tastaturbelegung.

## 2. Architektur und Bezug

- menu-model (002), Aktionssystem (007)

## 3. Umsetzung

1. Menüeinträge aus dem Aktionskatalog erzeugen.
2. macOS-Konventionen (App-Menü, Cmd+,), Windows/Linux (Alt-Mnemonics).

### Entscheidungsfragen (im Design-Dokument beantworten)

- keine

## 4. Erwartete Dateien und Schnittstellen

- Erweiterung `menu-model.ts`

## 5. Tests und Abnahmekriterien

**Tests**

- Menü-Spec je OS

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Cmd+, öffnet SETUP (macOS); Strg+, (Win/Linux)

## 6. Ausdrücklich nicht Teil dieses Prompts

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen
- README „Keyboard“

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

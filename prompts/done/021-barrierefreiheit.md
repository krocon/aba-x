# Prompt 021: Barrierefreiheit und Performance

> **Abhängigkeiten:** 006, 007 · **Aufwand:** M · **Betrifft:** Desktop + Web
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/barrierefreiheit`. Design-Dokument: `prompts/021-barrierefreiheit.design.md`.

## 1. Ziel

Systematische Prüfung und Behebung: Screenreader (VoiceOver, NVDA, Orca soweit möglich), Fokus, Kontraste (Gerät und Seite), reduzierte Bewegung, Zoom 200 %; Performance-Budget (Startzeit, Eingabelatenz).

## 2. Architektur und Bezug

- Master-Prompt §2 Produktprinzipien, `000-arbeitsweise.md` Phase 4

## 3. Umsetzung

1. Audit (axe/Playwright + manuell), Befundliste, Fixes.
2. Messung: Start bis erste Eingabe (Desktop < 1 s Ziel), Bundle-Budgets.

### Entscheidungsfragen (im Design-Dokument beantworten)

- keine

## 4. Erwartete Dateien und Schnittstellen

- `docs/accessibility.md`

## 5. Tests und Abnahmekriterien

**Tests**

- axe-Checks in E2E

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Keine kritischen axe-Befunde; Rechnen nur mit Tastatur und Screenreader möglich

## 6. Ausdrücklich nicht Teil dieses Prompts



## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

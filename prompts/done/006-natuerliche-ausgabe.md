# Prompt 006: Natürliche Ausgabe und Display-Feinschliff

> **Abhängigkeiten:** 005 · **Aufwand:** M · **Betrifft:** Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/natuerliche-ausgabe`. Design-Dokument: `prompts/006-natuerliche-ausgabe.design.md`.

## 1. Ziel

Ergebnisse und Stack-Einträge in Lehrbuchdarstellung, lesbar im LCD: Größenanpassung langer/hoher Ausdrücke, Scrollen durch den Stack, Ansehen eines Eintrags in voller Größe, Kopieren als LaTeX/Text.

## 2. Architektur und Bezug

- ADR 0003, 0006
- `<math-span>` im Display, feste Displayhöhe (keine springende Tastatur!)

## 3. Umsetzung

1. Stack-Navigation (▲ wählt Ebenen, Enter/RECALL holt in die Zeile, VIEW zeigt groß).
2. Automatische Verkleinerung bzw. horizontales Scrollen langer Ergebnisse.
3. Kopieren (Strg/Cmd+C) des gewählten Eintrags als LaTeX und Text; Einfügen in die Zeile.
4. Screenreader: jede Ebene mit gesprochenem Text (`getValue('spoken')` bzw. eigener Serializer).

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Wie viele Ebenen auf großen Bildschirmen?** fix 4 oder abhängig von der Höhe?

## 4. Erwartete Dateien und Schnittstellen

- `features/calculator/device/*`, `stack-view.ts`

## 5. Tests und Abnahmekriterien

**Tests**

- Navigation und Kopieren als Store-Specs
- Layout: Tastenfeld-Position unverändert bei hohen Einträgen (Playwright/Browser)

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Matrix, Integral und lange Summe bleiben im Display lesbar
- Tastenfeld springt nie
- VoiceOver liest Ebene 1 sinnvoll

## 6. Ausdrücklich nicht Teil dieses Prompts

- Graph-Darstellung (014)

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

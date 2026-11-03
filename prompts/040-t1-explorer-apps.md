# Prompt 040: ABA-T1 – Explorer-Apps (linear, quadratisch, trigonometrisch)

> **Abhängigkeiten:** 034 · **Aufwand:** S · **Betrifft:** Frontend (Kern nur für Aufgaben-Generator)
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-explorer`. Design-Dokument: `prompts/040-t1-explorer-apps.design.md`.

## 1. Ziel

Lern-Apps, in denen man den Graphen direkt bewegt und die Gleichung mitläuft:

- **Linear-Explorer:** `y = m·x + b` – Graph verschieben (Ziehen/Wippe) und Steigung ändern; Modus „Graph“ und
  „Gleichung“ (Parameter per +/− ändern).
- **Quadratisch-Explorer:** `y = a·(x+h)² + v` und Normalform; Scheitel, Nullstellen, Diskriminante sichtbar.
- **Trigonometrie-Explorer:** `y = a·sin(b·x+c)+d` (und cos); Amplitude/Periode/Phase per Geste.
- Je App ein **Übungsmodus**: zufälliger Graph → Gleichung bestimmen (oder umgekehrt), Punktestand, Hinweise.

## 2. Architektur und Bezug

- Vorbild Kap. 22 (Explorer-App). Plot-Fläche aus 033, Gesten aus 026.
- Aufgaben-Generator im Kern (rein, mit Startwert reproduzierbar), Prüfung von Nutzerantworten über Gleichheit
  der Parameter (Toleranzen).

## 3. Umsetzung

1. Gemeinsame Explorer-Basis (Parameter, Gesten → Parameteränderung, Anzeige der Gleichung in Textbuchform).
2. Drei Explorer + Übungsmodus.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Eine App mit drei Modi oder drei Apps in der Bibliothek? (Vorbild: drei; Empfehlung begründen.)
- Zusätzliche Explorer (kubisch, logarithmisch, wie im neueren Vorbild-Handbuch) jetzt oder später?

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/explore/generator.ts` + Specs; `apps/aba-t1/src/app/apps/explorer/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Generator: gültige, „schöne“ Parameter (ganzzahlig/einfache Brüche), Reproduzierbarkeit; Antwortprüfung.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Parabel per Ziehen verschieben, Gleichung aktualisiert sich; Übungsmodus-Runde per Touch und Tastatur.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Prüfungs-/Klassenzimmerfunktionen.

## 7. Doku

- Hilfe, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7

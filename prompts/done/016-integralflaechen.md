# Prompt 016: Integrationsflächen im Graph

> **Abhängigkeiten:** 012, 015 · **Aufwand:** S · **Betrifft:** Frontend + Kern
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/integralflaechen`. Design-Dokument: `prompts/016-integralflaechen.design.md`.

## 1. Ziel

Fläche zwischen Funktion und x-Achse (bzw. zwei Funktionen) zwischen wählbaren Grenzen markieren, positive/negative Anteile unterscheiden, Wert exakt oder numerisch anzeigen.

## 2. Architektur und Bezug

- Master-Prompt §3.6 „Graphische Darstellung“

## 3. Umsetzung

1. Grenzen per Cursor/Eingabe, Füllung im LCD-Stil, Wert aus 012/013.

### Entscheidungsfragen (im Design-Dokument beantworten)

- keine

## 4. Erwartete Dateien und Schnittstellen

- `features/graph/area.ts`

## 5. Tests und Abnahmekriterien

**Tests**

- Vorzeichenwechsel im Intervall
- Unstetigkeit im Intervall → Hinweis

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- ∫₀^π sin = 2 als Fläche und Wert

## 6. Ausdrücklich nicht Teil dieses Prompts



## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

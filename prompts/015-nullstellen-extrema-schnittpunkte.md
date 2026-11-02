# Prompt 015: Nullstellen, Extrema, Schnittpunkte, Tangenten

> **Abhängigkeiten:** 014 · **Aufwand:** M · **Betrifft:** Kern + Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/nullstellen-extrema-schnittpunkte`. Design-Dokument: `prompts/015-nullstellen-extrema-schnittpunkte.design.md`.

## 1. Ziel

Analyse im Graph-Modus: Nullstellen, Extrempunkte, Schnittpunkte zweier Funktionen, Tangente/Sekante an einer Stelle – berechnet im Kern, markiert im Plot.

## 2. Architektur und Bezug

- Numerik 013, Sampler 014, ggf. CAS für exakte Werte

## 3. Umsetzung

1. Kandidaten aus Sampling, Verfeinerung mit Brent/Newton; exakte Werte, wenn das CAS sie liefert.
2. Markierungen + Werte-Liste, Navigation per Tastatur.

### Entscheidungsfragen (im Design-Dokument beantworten)

- keine

## 4. Erwartete Dateien und Schnittstellen

- `src/math/graph/analysis.ts`

## 5. Tests und Abnahmekriterien

**Tests**

- Polynome, trig. Funktionen, doppelte Nullstellen, Berührpunkte

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- x²−4: Nullstellen ±2, Minimum (0,−4)

## 6. Ausdrücklich nicht Teil dieses Prompts

- Flächen (016)

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

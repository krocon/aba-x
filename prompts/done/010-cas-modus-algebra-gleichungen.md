# Prompt 010: CAS-Modus: Algebra und Gleichungen

> **Abhängigkeiten:** 009, 006 · **Aufwand:** M · **Betrifft:** Frontend + Kern
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/cas-modus-algebra-gleichungen`. Design-Dokument: `prompts/010-cas-modus-algebra-gleichungen.design.md`.

## 1. Ziel

Der CAS-Modus (F2) wird echt: Softmenü mit SIMP, EXPAND, FACTOR, SOLVE, SUBST …, exakte Ausgabe, Gleichungen und Gleichungssysteme (soweit unterstützt), verständliche Rückmeldung bei Unlösbarem.

## 2. Architektur und Bezug

- ADR 0006 (Softmenü je Modus)
- `device/softkeys.ts`, `CalculatorStore`

## 3. Umsetzung

1. Softmenü je Modus (NXT blättert); CAS-Funktionen wirken auf Zeile oder Ebene 1.
2. SOLVE mit Variable (Eingabe oder Standard `x`), Lösungsmengen inkl. allgemeiner Lösungen (`n·π`).
3. Unausgewertet bleibt sichtbar unausgewertet, mit Hinweis.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Welche Variable löst SOLVE ohne Angabe?** einzige freie Variable, sonst Rückfrage.

## 4. Erwartete Dateien und Schnittstellen

- `features/cas/*`, Softmenü-Definitionen

## 5. Tests und Abnahmekriterien

**Tests**

- Store-Specs mit Fake-Engine
- E2E-Fälle aus §6.2

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- `(x+1)^2` EXPAND → `x^2+2x+1`; `x^2-4=0` SOLVE → `x=−2, x=2`
- `x^5-x-1=0` → numerische Lösungen, als Näherung gekennzeichnet

## 6. Ausdrücklich nicht Teil dieses Prompts

- Ableitungen/Integrale (011/012)

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

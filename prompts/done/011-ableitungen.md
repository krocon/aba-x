# Prompt 011: Ableitungen und Grenzwerte

> **Abhängigkeiten:** 009, 010 · **Aufwand:** S · **Betrifft:** Kern + Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/ableitungen`. Design-Dokument: `prompts/011-ableitungen.design.md`.

## 1. Ziel

d/dx (Tastenfeld ⇧▶7), höhere Ableitungen, partielle Ableitungen, Grenzwerte – exakt über den Adapter, numerische Ableitung als Gegenprobe.

## 2. Architektur und Bezug

- Adapter 009, Numerik 013 (numerische Ableitung)

## 3. Umsetzung

1. `\frac{d}{dx}` und `\frac{d^n}{dx^n}` im Parser → Ableitungsknoten.
2. Softkeys DERIV, LIMIT im CAS-Menü.
3. Gegenprobe numerisch in Tests (Property).

### Entscheidungsfragen (im Design-Dokument beantworten)

- keine

## 4. Erwartete Dateien und Schnittstellen

- Erweiterungen in `src/math/symbolic/`, Fallkatalog

## 5. Tests und Abnahmekriterien

**Tests**

- Referenzen (Kettenregel, Produktregel, `x^x`, `ln`)
- Property: symbolisch ≈ numerisch

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- d/dx sin(x²) → 2x·cos(x²) in App und Web

## 6. Ausdrücklich nicht Teil dieses Prompts

- Integrale (012)

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

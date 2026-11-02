# Prompt 013: Numerische Verfahren

> **Abhängigkeiten:** 003 · **Aufwand:** L · **Betrifft:** Kern
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/numerische-verfahren`. Design-Dokument: `prompts/013-numerische-verfahren.design.md`.

## 1. Ziel

Eigene numerische Schicht: Nullstellen (Bisektion, Newton, Sekante, Brent als Empfehlung), numerische Ableitung, Quadratur (Trapez, Simpson, Gauß-Legendre, adaptiv) mit Fehler- und Konvergenzabschätzung und sauberem Umgang mit Grenzfällen.

## 2. Architektur und Bezug

- Master-Prompt §3.5, §3.6; ADR 0002

## 3. Umsetzung

1. `RootFinder`, `Integrator`, `Differentiator` als Interfaces, Ergebnis immer mit Genauigkeit/Iterationen oder Fehlercode.
2. Grenzfälle explizit: Division durch null, NaN/∞, Singularität im Intervall, keine Konvergenz, Über-/Unterlauf, leeres/vertauschtes Intervall.
3. Genauigkeitseinstellungen (für SETUP).

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Brent zusätzlich zu Bisektion/Newton/Sekante?** Empfehlung: ja, als Standard.

## 4. Erwartete Dateien und Schnittstellen

- `src/math/numeric/{roots,quadrature,derivative}.ts` + Kataloge

## 5. Tests und Abnahmekriterien

**Tests**

- Analytische Referenzen (∫₀^π sin = 2, …) mit Toleranzen
- jeder Grenzfall einzeln
- Konvergenzordnung grob geprüft

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Kern-Specs grün, im Worker aufrufbar

## 6. Ausdrücklich nicht Teil dieses Prompts

- UI

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen
- `docs/mathematics/numerics.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

# Prompt 005: Auswertung im Standard-Modus: ENTER rechnet

> **Abhängigkeiten:** 003, (004) · **Aufwand:** L · **Betrifft:** Kern + Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/auswertung-standardmodus`. Design-Dokument: `prompts/005-auswertung-standardmodus.design.md`.

## 1. Ziel

ENTER wertet die Eingabezeile aus und legt das **Ergebnis** auf den Stack (die Eingabe bleibt im Verlauf). Exakt, wo möglich (Brüche, Wurzeln, π), sonst numerisch – sichtbar unterschieden. Fehler verständlich im Display.

## 2. Architektur und Bezug

- ADR 0002, 0006 (Gerät, Stack)
- `CalculatorStore.enter()`, `entry-stack.ts` (heute nur Ausdrücke)
- Master-Prompt §3.1, §6.4

## 3. Umsetzung

1. Exakte Arithmetik im Kern (Ganzzahl/Bruch mit BigInt, einfache Wurzelvereinfachung), numerische Auswertung (double) mit Kennzeichnung.
2. Grundrechenarten, Potenzen, Wurzeln, Fakultät, Prozent, Betrag, Kehrwert, trig./hyperbolische Funktionen und Umkehrungen, exp/ln/log/log_b, Konstanten π, e; Grad/Bogenmaß (Annunciator RAD/DEG).
3. Stack-Einträge mit Ausdruck, Ergebnis (exakt/numerisch), Fehler; →NUM (Näherung eines exakten Ergebnisses) als Softkey/Shift-Funktion.
4. RPN-Verhalten bei leerer Zeile und Operator-Taste (z. B. `+` mit leerer Zeile addiert Ebene 1 und 2) – entscheiden.
5. Fehler im Display (Meldungszeile), Eingabe bleibt zum Korrigieren.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Algebraisch oder RPN?** Heute: algebraische Zeile + ENTER. Soll eine Operator-Taste bei leerer Zeile wie RPN auf den Stack wirken? Empfehlung: ja (Modus in SETUP).
- **Anzeige exakt + Näherung?** z. B. `√2` mit `≈1.41421356` darunter.

## 4. Erwartete Dateien und Schnittstellen

- `src/math/numeric/evaluate.ts`, `src/math/exact/{rational,simplify-radicals}.ts`
- `entry-stack.ts`/`calculator-store.ts` erweitert
- `*.cases.json` mit Referenzwerten

## 5. Tests und Abnahmekriterien

**Tests**

- Referenzwerte (Master-Prompt §6.2), `0.1+0.2` exakt als `3/10`, `sin(π/6)=1/2`
- Fehler: `1/0`, `ln(0)`, `sqrt(-1)` ohne komplexe Zahlen, unbekannte Variable
- Property: numerisch ≈ exakt

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- `1/3+1/6` ENTER → `1/2`; `√8` → `2√2`; →NUM → `2.828427…`
- `sin(30)` im DEG-Modus → `1/2`
- Fehler erscheinen lesbar, nichts stürzt ab

## 6. Ausdrücklich nicht Teil dieses Prompts

- Symbolik mit Variablen (009 ff.)
- Variablen-Zuweisung (008)

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

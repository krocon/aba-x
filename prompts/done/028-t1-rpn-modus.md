# Prompt 028: ABA-T1 – RPN-Eingabemodus

> **Abhängigkeiten:** 027 · **Aufwand:** M · **Betrifft:** Kern (Stack-Operationen), Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-rpn`. Design-Dokument: `prompts/028-t1-rpn-modus.design.md`.

## 1. Ziel

Mit Eingabe = RPN wird der Verlauf der Startansicht zum **Stack** (Ebenen nummeriert, 1 unten): Enter legt die
Eingabe ab bzw. dupliziert Ebene 1, Operatoren und Funktionen verbrauchen Ebenen, Stack-Befehle über die
Menüleiste nach Auswahl einer Ebene: **PICK, ROLL ↑/↓, SWAP, DROPN, ECHO, →LIST, DUP, Anzeigen**, Löschen aller
Elemente. Funktionen mit mehreren Argumenten nehmen die Anzahl aus dem Stack oder per Klammer-Argument (`SIN`,
`+`, `x^y`, …) wie im Vorbild.

## 2. Architektur und Bezug

- ABA-X1 hat einen Stack (`entry-stack.ts`) – prüfen, was davon gerätunabhängig ist und nach `packages/core` oder
  `@aba/math` gehört (reine Stack-Operationen), statt zu kopieren.
- Vorbild Kap. 3: Verlauf im RPN-Modus, Beispielberechnungen, PICK, ROLL, SWAP, DROPN, ECHO, Anzeigen, Löschen.

## 3. Umsetzung

1. **Stack-Operationen rein** (`rpn-stack.ts`): unveränderliche Operationen mit Fehlercodes (zu wenige Argumente).
2. **Operator-Stelligkeit** aus dem Funktionskatalog (`functions.ts`) – eine Quelle.
3. **Auswahlmodus:** Wippe/Touch wählt eine Ebene, Menüleiste zeigt die Stack-Befehle, Esc beendet.
4. **Umschalten** Textbuch/Algebraisch ↔ RPN ohne Datenverlust (Verlauf ↔ Stack-Abbildung festlegen).
5. **Rückgängig** der letzten Stack-Operation (falls im Design entschieden).

### Entscheidungsfragen (im Design-Dokument beantworten)

- Gemeinsamer Stack-Kern mit ABA-X1 oder getrennt (Semantik vergleichen)?
- Verhalten von Enter bei leerer Eingabe (DUP) und von ⌫ bei leerer Eingabe (DROP) – wie Vorbild?

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/rpn/rpn-stack.ts` oder `packages/core/src/…` (je nach Entscheidung) + Specs
- `apps/aba-t1/src/app/features/home/rpn-*`

## 5. Tests und Abnahmekriterien

**Tests**

- Jede Stack-Operation tabellarisch (Stack vorher, Argument, Stack nachher, Fehler).
- Moduswechsel erhält Inhalte.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- `3 Enter 4 +` → 7; `2 Enter 3 xʸ` → 8; SWAP/ROLL/PICK per Touch und per Tastatur.
- Persistenz des Stacks nach Neustart.

## 6. Ausdrücklich nicht Teil dieses Prompts

- RPN in der CAS-Ansicht (Vorbild: nur Startansicht).

## 7. Doku

- Hilfe/README (RPN-Bedienung), `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Abweichungen vom Vorbild-Verhalten mit Begründung

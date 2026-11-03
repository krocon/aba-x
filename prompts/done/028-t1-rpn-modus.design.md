# Design 028 – ABA-T1: RPN-Eingabemodus

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 eigener Stack-Kern `@aba/math/rpn` auf `Value`s; ABA-X1 behält seinen Stack exakter Ausdrücke
  (andere Semantik, kein gemeinsamer Kern) · E2 Enter auf leerer Zeile = DUP, ⌫ auf leerer Zeile = DROP (wie das
  Vorbild) · E3 Verlauf und Stack sind getrennte Dokumente (`home`, `rpn`), der Moduswechsel verliert nichts · E4
  Sto ▶ speichert Ebene 1 unter dem eingetippten Namen und lässt sie liegen · E5 kein Rückgängig

## Bausteine

`rpn-stack.ts` (push, drop, dup, swap, pick, roll, rollDown, dropN, apply mit `Operation` → `evaluateValue`, Argumente
als `$1…$n` im Scope) · `RpnStore` (Persistenz, Fehlermeldung in der Titelzeile) · `rpn-keys.ts` · `RpnView`.

## Fortschritt

- [x] Kern 12 Specs · [x] App: 3 Specs, E2E Chromium/WebKit (3 4 + = 7, 2 3 xʸ = 8, SWAP, DROP)

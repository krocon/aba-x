# Prompt 026: ABA-T1 – Gerät, Tastenfeld, Wippe und Touch-Display

> **Abhängigkeiten:** 025 · **Aufwand:** L · **Betrifft:** Frontend, `packages/core` (Aktionssystem)
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-geraet`. Design-Dokument: `prompts/026-t1-geraet-tastenfeld-touch.design.md`.

## 1. Ziel

Das ABA-T1-Gerät ist vollständig bedienbar – noch ohne Rechenlogik: alle Tasten mit Haupt-, Shift- und
Alpha-Belegung, Shift/Alpha-Zustände (einmalig, gesperrt, Klein-/Großbuchstaben), Wippe für den Cursor,
kontextabhängige Touch-Menüleiste (6 Schaltflächen), Touch-Gesten im Display, Hardware-Tastatur je OS und ein
Aktionssystem, an das die Ansichten (027 ff.) ihre Aktionen hängen.

## 2. Architektur und Bezug

- Vorbild-Tastenfeld (Lage gleich, Gestaltung eigen, Master-Prompt ABA-T1 §1/§2):
  - **Oben links:** Apps (Shift: Info), Home (Shift: Settings), Symb / Plot / Num (Shift: jeweils Setup).
  - **Mitte:** Wippe (4 Richtungen; Shift+Richtung = Anfang/Ende).
  - **Oben rechts:** Help (Shift: User), Esc (Shift: Clear), View (Shift: Copy), CAS (Shift: CAS-Settings),
    Menu (Shift: Paste).
  - **Funktionsblock 6 Spalten:** Vars (Chars) · Toolbox (Mem) · Vorlage (Units) · x,t,θ,n (Define) · a b/c
    (Sexagesimal) · ⌫ (Del) / xʸ (ʸ√x) · SIN (ASIN) · COS (ACOS) · TAN (ATAN) · LN (eˣ) · LOG (10ˣ) / x² (√) ·
    +/− (|x|) · ( ) (Index/Untertext) · , (Eval) · Enter (doppelt breit).
  - **Ziffernblock:** EEX (Sto▶) · 7 (List) 8 ({}) 9 (!,∞,→) · ÷ (x⁻¹) / Alpha · 4 (Matrix) 5 ([]) 6 (≤≥≠) · × (∠) /
    Shift · 1 (Program) 2 (i) 3 (π) · − (Base) / On (Off) · 0 (Notes) · . (=) · Leer (_) · + (Ans).
  - Alpha-Buchstaben A–Z und Sonderzeichen (`:`, `;`, `"`, `#`, `'`) wie beim Vorbild verteilt (aus dem Foto im
    Design-Dokument als Tabelle erfassen).
- 024-Design §8: generischer Aktions-Dispatcher mit app-eigener `ActionId` → jetzt nach `packages/core` herauslösen
  (ABA-X1 zieht nach, ohne Verhaltensänderung).
- `CLAUDE.md` Regeln: Tasten nehmen der Eingabe nie den Fokus (`pointerdown` → `preventDefault`), jede Taste hat
  `aria-label`, Shift/Alpha `aria-pressed`.

## 3. Umsetzung

1. **Tastenmodell** `keypad-model.ts` (rein, testbar): Taste → `{ id, main, shift, alpha, alphaShift, span }`,
   Aktions-IDs statt Text. Beschriftungen aus dem Modell, Übersetzungen in `texts.ts`.
2. **Zustandsautomat Shift/Alpha** (rein): Shift einmal; Alpha einmal; Alpha zweimal = gesperrt; Shift+Alpha =
   Kleinbuchstaben; Esc löst Sperren. Anzeige als Annunciator in der Titelzeile.
3. **Aktionssystem in `packages/core`:** `Dispatcher<ActionId>`, Kontext-Stack (welche Ansicht hat den Fokus),
   Menüleiste als Datenmodell `MenuBar = [Softkey × 6]` je Kontext, Shift-Varianten der Menütasten.
4. **Wippe:** Klick auf die vier Sektoren (und Tastatur-Pfeile), Halten = Wiederholung.
5. **Touch-Display:** Pointer Events, Gestenerkennung (Tippen, Doppeltippen, Ziehen, Wischen, Pinch) als reine
   Logik + dünne Komponente; Ansichten registrieren Handler. `touch-action` und `prefers-reduced-motion` beachten.
6. **Hardware-Tastatur je OS:** Ziffern/Operatoren/Buchstaben direkt; Vorschlag z. B. `F1`–`F6` = Menüleiste,
   `Esc` = Esc, `Ctrl/⌘+H` = Home, `Ctrl/⌘+K` = CAS, `F7`–`F9` = Symb/Plot/Num, `Shift`/`Alt`-Taste auf dem
   Bildschirm nicht nötig (echte Modifikatoren). Virtuelle Taste leuchtet auf. Tabelle im Design.
7. **Ein/Aus:** On = Abbrechen laufender Berechnung (später), Shift+On = „Aus“ (Desktop: Fenster minimieren?
   Web: Bildschirm abdunkeln?) – entscheiden.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Was wandert nach `packages/core`?** Dispatcher und Gestenlogik ja; Keymap und Menümodell bleiben app-eigen.
- **Kürzel-Konflikte** mit Browser/OS (z. B. `Ctrl+H`, `⌘+K`) – je OS Alternativen.
- **Mobile:** Tastenfeld scrollt nie; ab welcher Breite wird skaliert, ab wann Querformat?

## 4. Erwartete Dateien und Schnittstellen

- `apps/aba-t1/src/app/core/actions/{keymap.ts,keypad-model.ts,shift-alpha.ts}`
- `packages/core/src/actions/{dispatcher.ts,gestures.ts}` (+ Specs), Anpassung `apps/aba-x1` an den Dispatcher
- `apps/aba-t1/src/app/features/device/{t1-device.ts,keypad.ts,rocker.ts,menu-bar.ts,display.ts}`

## 5. Tests und Abnahmekriterien

**Tests**

- Tastenmodell vollständig (jede Taste hat `aria-label`, keine doppelte Aktions-ID, Alpha A–Z vollständig).
- Shift/Alpha-Automat: alle Übergänge tabellarisch. Gesten: synthetische Pointer-Folgen → erkannte Geste.
- Keymap je OS: jedes Kürzel löst genau eine Aktion aus.
- ABA-X1-Specs unverändert grün nach dem Umzug des Dispatchers.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Jede Taste per Maus, Touch (Chromium-Touch-Emulation) und Hardware-Tastatur auslösbar; Eingabe behält Fokus.
- Shift/Alpha-Anzeige korrekt; Menüleiste wechselt mit dem Kontext (Demo-Kontext reicht).
- 375 px, hell/dunkel, Tastaturfokus sichtbar; axe ohne Befund.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Rechnen, Startansicht, Menüinhalte der Toolbox (027 ff.).

## 7. Doku

- README/Hilfe: Tastenbelegung je OS, `docs/accessibility.md`, `docs/architecture.md` (Dispatcher in core),
  `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Tastenbelegungstabelle (Haupt/Shift/Alpha) und Kürzel je OS
- nicht geprüfte Plattformen und Geräte (echtes Touch-Gerät?) mit Grund

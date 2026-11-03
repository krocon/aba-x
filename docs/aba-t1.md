# ABA-T1 – Bedienung und Stand

> Zweiter Rechner im Monorepo (ADR 0008), Bedienkonzept nach dem HP Prime G2 (Vision:
> [`prompts/000-ABA-T1-Master-Prompt.md`](../prompts/000-ABA-T1-Master-Prompt.md)). Diese Seite wächst mit jedem
> Prompt (025–048); Fortschritt in [`roadmap.md`](roadmap.md).

## Gerät (025/026)

- Display fest 4:3 mit Titelzeile (Ansicht, Annunciators ⇧, A/a, 🔒, später RAD/DEG) und sechs Touch-Menütasten.
- Tasten oben: Apps (⇧ Info), ⌂ Home (⇧ Settings), Symb/Plot/Num (⇧ Setup), Wippe, Help (⇧ User), Esc (⇧ Clear),
  View (⇧ Copy), CAS (⇧ Settings), Menu (⇧ Paste).
- Shift wirkt auf die nächste Taste; Alpha einmal = ein Buchstabe, zweimal = gesperrt, dreimal = aus; Shift + Alpha
  = Kleinbuchstaben; Esc löst Shift und Alpha. Shift + On = Aus (Display dunkel), On = wieder an.
- Wippe: Klick bewegt einmal, Halten wiederholt. Display: Tippen, Doppeltippen, langes Drücken, Ziehen, Wischen,
  Zwei-Finger-Pinch (Maus, Stift und Finger gleich).

## PC-Tastatur

Ziffern, `+ - * / ^ ( ) , .`, Leertaste, Enter, Backspace (Entf = Del), Esc (⇧Esc = Clear), Pfeiltasten (= Wippe,
mit ⇧ = Wippe mit Shift) und Buchstaben (= Alpha-Zeichen) wirken wie die Gerätetasten, solange kein Eingabefeld den
Fokus hat. Dazu (`Mod` = ⌘ auf macOS, sonst Strg; gleich auf allen Systemen):

| Kürzel | Taste | Kürzel | Taste |
|---|---|---|---|
| F1–F6 | Menütasten 1–6 | F7 / ⇧F7 | Symb / Symb-Setup |
| F8 / ⇧F8 | Plot / Plot-Setup | F9 / ⇧F9 | Num / Num-Setup |
| F10 / ⇧F10 | Help / User | Alt+A / Alt+⇧A | Apps / Info |
| Alt+H / Alt+⇧H | Home / Settings | Alt+K / Alt+⇧K | CAS / CAS-Settings |
| Alt+M | Menu | Alt+W | View |
| Alt+T / Alt+⇧T | Toolbox / Mem | Alt+V / Alt+⇧V | Vars / Chars |
| Alt+P / Alt+⇧P | Vorlagen / Units | Alt+X / Alt+⇧X | x,t,θ,n / Define |
| Mod+⇧C / Mod+⇧V | Copy / Paste | Alt+S / Alt+L | Shift / Alpha |
| Alt+O / Alt+⇧O | On / Off | Mod+/ | Tastaturübersicht |

Alt-Kombinationen werden über `event.code` erkannt (macOS-Sonderzeichen mit ⌥ stören nicht). Strg+H/⌘H, ⌘K usw.
sind bewusst nicht belegt (Browser/OS).

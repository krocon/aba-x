# Design 026 – ABA-T1: Gerät, Tastenfeld, Wippe und Touch-Display

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 Chords + Dispatcher + Gesten nach `packages/core`, Keymap/Tastenmodell app-eigen ·
  E2 Kürzel F1–F10 und Alt-Kombinationen (keine Strg/⌘-Buchstaben außer ⇧C/⇧V) · E3 Shift + On = Display aus
  (Desktop und Web gleich, kein Minimieren) · E4 Tastenfeld skaliert nicht, unter 400 px engere Abstände

## Bausteine

| Baustein | Ort | Inhalt |
|---|---|---|
| `chords.ts` | `@aba/core/actions` | Chord, Keymap<A>, matches/resolve/formatChord/accelerator (aus ABA-X1 verschoben) |
| `ActionDispatcher<A>` | `@aba/core/actions` | Capture-Listener, Handler je Aktion; ABA-X1 `KeyboardDispatcher` erbt |
| `GestureRecognizer` | `@aba/core/actions` | Tap, Doppeltipp, langes Drücken, Ziehen, Wischen, Pinch (rein) |
| `shift-alpha.ts` | ABA-T1 | Automat Shift/Alpha/Lock/Kleinbuchstaben, Annunciators |
| `keymap.ts`, `T1Keyboard` | ABA-T1 | Chords (Capture) + einfache Tasten → Gerätetasten (Bubble, nicht in Eingabefeldern) |
| `DeviceStore` | ABA-T1 | Kontext-Stack der Ansichten, App-Aktionen als Rückfall, An/Aus, Leuchten |

## Verträge

`ViewContext { id, title(), menu(), key?(KeyPress) → boolean, menuPress?(i, shift), rocker?(dir, shift) → boolean,
gesture?(g, area) }`; `KeyPress { id, layer: 'main'|'shift'|'alpha', char? }`. Ansichten (027 ff.) legen ihren
Kontext mit `device.push()` auf; App-weite Navigation (`apps`, `home`, `cas`, …) über `device.onGlobal()`.

## Fortschritt

- [x] Core: Chords, Dispatcher (ABA-X1 unverändert: 78 → 83 Specs inkl. Gesten), Gesten
- [x] ABA-T1: Automat, Keymap, Keyboard, DeviceStore, Gerät (Gesten, Wippe-Wiederholung, Aus), Tastaturübersicht
- [x] Specs 26, E2E (Shift/Alpha), Browser-Prüfung

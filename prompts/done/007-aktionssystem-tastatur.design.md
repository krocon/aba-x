# Design 007 – Aktionssystem und Tastatur

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen
- E1 `core/actions/keymap.ts` (rein): Aktions-Ids, Akkorde mit `Mod` (⌘/Strg), Buchstaben über `event.code`
  (layout-unabhängig, ⌥R auf dem Mac liefert sonst „®“), Anzeige je OS.
- E2 `KeyboardDispatcher`: ein Listener in der Capture-Phase vor dem Mathefeld, verbraucht nur Akkorde aus der Keymap;
  Features registrieren Handler. Zeilentasten (Enter, Esc, Tab, Pfeile) bleiben beim Mathefeld.
- E3 Kürzel: F1–F6, ⇧↩ →NUM, ⌥R RAD/DEG, ⌥E EXACT/APPROX, ⌥⌫ DROP, ⌥S SWAP, ⌥⇧⌫ Stack leeren, ⌘/ Übersicht.
  Keine Browser-Standardkürzel überschrieben.
- E4 Alpha: α einmal = ein Buchstabe, zweimal = feststellen, dreimal = aus; ◀⇧ + Taste = Großbuchstabe.
- E5 Übersicht als Dialog (`role=dialog`, Fokus hinein und zurück, Esc schließt), auch über einen Link in der
  Statuszeile erreichbar.
- Nutzerdefinierte Kürzel: später (wie FnF Keymap-Override), nicht Teil von 007.

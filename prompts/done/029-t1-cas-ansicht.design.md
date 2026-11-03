# Design 029 – ABA-T1: CAS-Ansicht und Engine

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc (Engine: Nerdamer erweitern, kein Giac)
- Entscheidungen: E1 Nerdamer bleibt für beide Apps (ABA-X1 unverändert) · E2 ein Befehls-Interpreter
  `runCas` im Kern, eine Worker-Op `cas` · E3 eigene reine Verfahren für Ganzzahlen und Taylor, Nerdamer für
  Partialbrüche, Division (`div`), Koeffizienten, ggT/kgV, Summen, Laplace – alles mit Gegenprobe · E4 Äquivalente
  Formen werden nicht vereinheitlicht; Tests vergleichen Werte · E5 Startvariablen (großer Anfangsbuchstabe) als
  Zahlen, CAS-Variablen getrennt · E6 Befehlswörter: MathLive-Kürzel → `\operatorname{…}` plus `markCommands`
  (MathLive schreibt `\operatorname{\mathrm{…}}`; „or“ würde sonst zu ∨)

Lücken-Tabelle: `docs/mathematics/cas-aba-t1.md`.

## Fortschritt

- [x] Kern: `integer.ts` (6 Specs-Gruppen), `cas-commands.ts` (6 Gruppen), Worker-Op · [x] App: Logik, Store,
  Ansicht, CAS-Einstellungen, Kopie/Einfügen zwischen Ansichten · [x] E2E solve und ifactor (Chromium, WebKit)

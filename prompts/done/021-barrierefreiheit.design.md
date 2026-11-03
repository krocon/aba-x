# Design 021 – Barrierefreiheit und Performance

- Status: umgesetzt · Datum: 02.11.2026

## Entscheidungen

- E1 axe-core im E2E (Chromium, WebKit): „serious“/„critical“ lassen den Lauf scheitern. Befund behoben:
  `aria-label` an Elementen ohne Rolle → versteckter Text.
- E2 E2E prüft echtes Tippen, 375 px ohne Querscrollen und das **gerenderte** Display (Befund: wiederverwendete
  Stack-Zeilen zeigten alte Formeln → `MathStatic` rendert bei jeder Änderung neu).
- E3 Messwerte und offene Punkte (Screenreader von Hand) in `docs/accessibility.md`.

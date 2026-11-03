# Design 032 – ABA-T1: Listen und Matrizen

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 eigene lineare Algebra (kein Paket; LU, Gauß-Jordan, Jacobi, Hessenberg-QR) · E2 Matrizen
  reell (double) in der Startansicht, exakt/symbolisch über das CAS (det, inv, trn) · E3 Listen und Vektoren sind
  derselbe Typ; `{…}` und `[…]` lesen beide als Liste, verschachtelt als Matrix · E4 ein Tabelleneditor für Listen
  und Matrizen (Statistikdaten 037, Spreadsheet 041 bauen eigene Varianten – das Raster ist klein) · E5 Elementzugriff
  über `get(L, i)` statt `L1(2)` (Klammer nach einer Variablen bleibt Multiplikation) · E6 getippte Namen: `L0–L9`,
  `M0–M9` und Katalogwörter werden vor dem Parsen erkannt, MathLive-Kürzel in Start/CAS durch eigene ersetzt

## Fortschritt

- [x] Kern: `linalg` (5 Specs mit Eigenschaften), Werte + Auswerter (40 Fälle), Parser `{}`/`\lbrace`, CAS-Matrix
- [x] App: Katalog, Editor, Tasten ⇧4/⇧7/⇧5/⇧8, Toolbox List/Matrix, Hilfe, E2E (L0-Summe, det M1)

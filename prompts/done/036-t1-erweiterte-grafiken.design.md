# Design 036 – ABA-T1: Erweiterte Grafiken

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 Intervallarithmetik mit Außenrundung (`interval/`), dreiwertige Wahrheit je Zelle; nur sicher wahre
  Zellen werden als Gebiet gefüllt, unentscheidbare grau – nie als Teil des Gebiets · E2 Quadtree bis Pixelgröße mit Zeit-
  und Zellbudget (`graph/implicit.ts`, Hinweis bei Abbruch) · E3 Ränder per Marching Squares mit Regula falsi, strikte
  Ränder gestrichelt; keine Linie über Polstellen · E4 Verknüpfungen als Funktionen `and/or/not/xor` (Parser-Option
  `functions`, MathLive-Kürzel), keine Infix-Logik · E5 Symb über die generische Kurven-Symb (Art `relation`, V1…V0);
  Trace = Tangentenschritt + Newton-Projektion (`traceBoundary`); Num = Randpunkte je X (`boundaryCrossings`) ·
  E6 Plot pro Formel/Ansicht/Größe zwischengespeichert, damit der Trace nicht neu rechnet

## Fortschritt

- [x] Kern Intervalle + implizites Plotten · [x] Plot (Gebiete, Ränder, Trace, Galerie), Num, Setups, Hilfe DE/EN
- [x] Unit-Spec (Relationen, Fehler, Variablen ohne X/Y) · [x] E2E (Kreisscheibe, Rand Y = ±3 bei X = 0)

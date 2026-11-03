# Einheiten, Konstanten, Basis-Ganzzahlen (Prompt 031)

## Einheiten

- Schreibweise: `5_m`, `100_km/_h` (jede Einheit mit eigenem Unterstrich), LaTeX `5\mathrm{\_km}`; in MathLive
  wird `5_m` (Tiefstellung nach einer Zahl) automatisch zur Einheit. Ein Unterstrich bindet wie ein Faktor:
  `6_m/2_m` ist `(6·m/2)·m` – für Quotienten Klammern setzen: `(6_m)/(2_m)`.
- Modell (`units/units.ts`): Einheitenausdruck = Produkt benannter Einheiten mit ganzen Exponenten; Auflösung über
  die Tabelle `units.data.ts` (Faktor zu SI, Dimensionsvektor m·kg·s·A·K·mol·cd), SI-Präfixe für metrische
  Einheiten (exakter Name hat Vorrang: `min`, `cd`, `Pa`).
- Rechnen: × ÷ ^ kombinieren Einheiten; + − rechnen den rechten Operanden in die Einheit des linken um und verlangen
  gleiche Dimension; Vergleiche ebenso. `convert`, `mksa`, `ufactor`, `usimplify`. Winkel mit Einheit (`30_deg`)
  rechnen trigonometrisch unabhängig vom Winkelmodus.
- Temperaturen: °C, °F mit Nullpunktverschiebung werden nur von `convert` zwischen zwei reinen Temperaturen absolut
  umgerechnet; in jeder anderen Rechnung sind sie Temperaturdifferenzen (`20_degC + 5_K = 25 °C`).
- Definitionen exakt, wo es sie gibt (inch, pound, calorie, eV seit 2019, …); Tests: 18 Umrechnungen gegen
  Referenzwerte, Dimensionsfehler, Temperaturfälle.

## Konstanten

`units/constants.data.ts`: CODATA 2022 (NIST, Mai 2024), exakte Werte seit der SI-Neudefinition 2019 markiert. Das
Units-Menü (⇧Vorlage) fügt Wert × Einheit ein.

## Basis-Ganzzahlen

`#1010b`, `#777o`, `#99d`, `#FFh` – ein abschließendes b/o/d/h ist Suffix, wenn die übrigen Ziffern zur Basis
passen (`#1B` = binär 1, `#1Bh` = 27), sonst gilt die eingestellte Basis. Wortbreite 8/16/32/64 Bit, ohne oder mit
Vorzeichen (Zweierkomplement), Werte als BigInt maskiert. + − × ÷ (Richtung 0) ^, `bitand`, `bitor`, `bitxor`,
`bitnot`, `bitsl`, `bitsr`, `bitasr`, `bitrl`, `bitrr`, `r2b`, `b2r`, `bin/oct/dec/hex`. Mit Brüchen gemischt wird
reell gerechnet.

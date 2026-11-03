# Listen und Matrizen (Prompt 032)

- Listen `{1, 2, 3}` (auch `[1, 2, 3]`): elementweise Arithmetik, Skalare werden verteilt, Funktionen wirken
  elementweise, Vergleiche liefern Listen aus 0/1; `size`, `sumlist`, `prodlist`, `deltalist`, `sort`, `reverse`,
  `concat`, `pos`, `get`, `makelist(expr, var, a, b[, step])` (≤ 100 000 Elemente); Listen sind auch Vektoren
  (`dot`, `cross`, `norm`, Matrix × Liste).
- Matrizen `[[1, 2], [3, 4]]` bzw. `pmatrix`, reelle Einträge: + − (gleiche Größe), × Matrixprodukt, ^ ganzzahlig
  (negativ = Inverse), ÷ durch Skalar oder reguläre Matrix; `det`, `inv`, `trn`, `rref`, `rank`, `trace`, `norm`
  (Frobenius), `eigval`, `eigvec` (symmetrisch), `linsolve`, `identity`, `randmat`.
- Verfahren (`linalg/linalg.ts`): LU mit Spaltenpivotisierung (Determinante, Gleichungssysteme), Gauß-Jordan mit
  Pivotisierung (RREF, Rang, Inverse); „singulär“ heißt Pivot ≤ 10⁻¹² · max|aᵢⱼ| · n – nie Division durch Rauschen.
  Eigenwerte: Jacobi-Rotationen für symmetrische Matrizen (mit Eigenvektoren), sonst Hessenberg-Reduktion und
  verschobenes QR-Verfahren (komplexe Paare aus 2×2-Blöcken), Abbruch nach 60 Iterationen je Eigenwert
  (`no-convergence`).
- Gegenproben in den Specs: A·A⁻¹ = I, det(AB) = det A · det B (zufällige 4×4), A·v = λ·v, Σλ = Spur (5×5).
- CAS: `det`, `inv`, `trn` exakt mit Symbolen (Nerdamer), numerisch an Stichproben geprüft.
- Genauigkeit: double; schlecht konditionierte Matrizen (Hilbert ab n ≈ 10) verlieren Stellen – keine
  Konditionswarnung (offen).

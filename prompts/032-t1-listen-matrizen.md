# Prompt 032: ABA-T1 – Listen und Matrizen

> **Abhängigkeiten:** 027, 030 · **Aufwand:** L · **Betrifft:** Kern (lineare Algebra, Listen), Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-listen-matrizen`. Design-Dokument: `prompts/032-t1-listen-matrizen.design.md`.

## 1. Ziel

- **Listen:** Literale `{1,2,3}`, Listenvariablen L0–L9 (und benannte), **Listenkatalog und -editor** (Shift+7),
  elementweises Rechnen, Listenfunktionen (Länge, Summe, Produkt, ΔLIST, Sortieren, Umkehren, Verketten, Position,
  Sequenz `MAKELIST`, Statistik-Grundfunktionen).
- **Matrizen/Vektoren:** Literale `[[1,2],[3,4]]`, Variablen M0–M9, **Matrixkatalog und -editor** (Shift+4),
  Rechnen (+, −, ×, Skalar, Potenz, Inverse), Funktionen (Determinante, Transponierte, Rang, Spur, Norm,
  Zeilenstufenform/RREF, LU, QR, Cholesky, Eigenwerte/-vektoren numerisch, Kreuz-/Skalarprodukt, Identität,
  Zufallsmatrix, lineares Gleichungssystem lösen). Im CAS exakt (Brüche, Symbole), soweit die Engine es kann.

## 2. Architektur und Bezug

- Vorbild Kap. 26 (Listen), 27 (Matrizen); Vorlagen-Taste (027) liefert Matrix-/Vektor-Vorlage.
- AST braucht ggf. Knoten für Liste/Matrix – prüfen, ob `@aba/math` sie schon hat (13 Knotentypen).
- Numerik im Kern mit klaren Fehlercodes (singulär, Dimension, keine Konvergenz).

## 3. Umsetzung

1. **AST/Parser/Serializer/LaTeX** für Liste und Matrix (Round-Trip), Auswertung elementweise/Broadcast-Regeln.
2. **Lineare Algebra** rein in `@aba/math/linalg` (Pivotisierung, Toleranzen; Eigenwerte z. B. QR-Verfahren /
   Jacobi für symmetrische) – oder Bibliothek, siehe Entscheidung.
3. **Editoren** als Tabellenansicht mit Wippe/Touch, Zelle bearbeiten, Zeile/Spalte einfügen/löschen, Größe,
   Senden in die Eingabe; Kataloge mit Umbenennen/Löschen/Leeren.
4. **Persistenz** der Variablen.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Eigene lineare Algebra vs. Bibliothek (Größe, Lizenz, Genauigkeit; exakte Brüche?).
- Zahlentyp in Matrizen: nur double (Startansicht) und symbolisch über das CAS?
- Gemeinsames Tabellen-Editor-Gerüst für 032/037/041 (Statistikdaten, Spreadsheet) – jetzt entwerfen.

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/ast/*` (Liste/Matrix), `packages/math/src/linalg/*`, `packages/math/src/lists/*` + Cases
- `apps/aba-t1/src/app/features/{lists,matrices,shared/grid-editor}/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Referenzfälle (det, inv, rref, Eigenwerte bekannter Matrizen), Property-Tests (`A·A⁻¹ ≈ I`, `det(AB)=det A·det B`),
  singuläre/fast singuläre Matrizen, Dimensionsfehler, Listen-Broadcast.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Matrix im Editor anlegen, `det(M1)` und `M1⁻¹` in der Startansicht; Liste L1 sortieren; Gleichungssystem lösen.
- Editor per Touch und Tastatur bedienbar; Daten nach Neustart vorhanden.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Statistik-Apps (037), Linearlöser-App (039), Spreadsheet (041).

## 7. Doku

- `docs/mathematics/linalg.md`, Hilfe, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Genauigkeitsgrenzen der Numerik; Review-Schwerpunkte für den separaten Agenten (Pivotisierung, Toleranzen)

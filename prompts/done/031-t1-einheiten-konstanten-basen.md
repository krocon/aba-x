# Prompt 031: ABA-T1 – Einheiten, Konstanten und Ganzzahl-Basen

> **Abhängigkeiten:** 030 · **Aufwand:** M · **Betrifft:** Kern, Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-einheiten`. Design-Dokument: `prompts/031-t1-einheiten-konstanten-basen.design.md`.

## 1. Ziel

- **Einheiten** (Shift+Vorlage „Units“): Zahlen mit Einheit (`5_m`, `3_km/h`), Rechnen mit Einheiten
  (Dimensionsprüfung), Umrechnen (`CONVERT`), Basiseinheiten (`MKSA`), Vereinfachen (`UFACTOR`, `USIMPLIFY`),
  Präfixe; Menü nach Kategorien (Länge, Fläche, Volumen, Zeit, Geschwindigkeit, Masse, Kraft, Energie, Leistung,
  Druck, Temperatur, Elektrizität, Winkel, Licht, Strahlung, Viskosität …).
- **Konstanten** (im Einheiten-Menü): Mathematik (e, π, i, ∞ …), Chemie, Physik, Quantenphysik – mit oder ohne
  Einheit einsetzbar; Werte aus **CODATA** (Version und Quelle dokumentieren).
- **Ganzzahl-Basen** (Shift+− „Base“): `#1010b`, `#FFh`, `#777o`, `#99d`, Wortbreite 1–64 Bit, mit/ohne
  Vorzeichen, Logik (AND, OR, XOR, NOT), Shift/Rotate, Umrechnung; Standardbasis in den Einstellungen (027).

## 2. Architektur und Bezug

- Vorbild Kap. 25 (Einheiten und Konstanten), Kap. 30 (Ganzzahlarithmetik).
- Kern: neue Module in `@aba/math` (auch für ABA-X1 nutzbar), Parser-Erweiterung `_einheit` und `#…b/o/d/h`.
- Temperatur: absolute vs. Differenz (°C/K/°F) – Sonderfall ausdrücklich testen.

## 3. Umsetzung

1. **Einheitenmodell** rein: Dimension als Exponentenvektor (SI-Basis), Faktor, Offset; Tabelle als Daten mit
   Quellenangabe; Parser/Serializer/LaTeX-Ausgabe für Einheiten.
2. **Konstanten** als Daten (Wert, Unsicherheit, Einheit, Quelle).
3. **Ganzzahlen** mit `BigInt` und Wortbreiten-Maskierung; Ausgabe je Basis.
4. **Menüs** (Toolbox-Struktur aus 030), Einfügen per Touch/Wippe.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Eigenes Einheitenmodul vs. Bibliothek (z. B. math.js-Units: Größe, Lizenz Apache-2.0, Genauigkeit) –
  Empfehlung mit Messung.
- Einheiten auch im CAS (symbolisch) oder nur in der Startansicht?

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/units/{units.ts,units.data.ts,constants.data.ts}`, `packages/math/src/integer/base.ts`
- Parser-Erweiterung + `*.cases.json`; `apps/aba-t1/src/app/features/units/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Umrechnungstabelle (≥ 40 Fälle), Dimensionsfehler (`1_m + 1_s`), Temperaturfälle, Präfixe.
- Konstanten gegen CODATA-Werte; Basen: Überlauf/Maskierung je Wortbreite, Vorzeichen, Round-Trip.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- `CONVERT(100_km/h, 1_m/s)` → 27.777…_m/s; `#FFh + #1b` → `#100h`; Lichtgeschwindigkeit einsetzen.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Einheiten in Tabellen/Spreadsheet (041), Programmierbefehle für Einheiten (043).

## 7. Doku

- `docs/mathematics/units.md` (Modell, Quellen), Hilfe, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Abgedeckte Einheitenkategorien und Konstanten, CODATA-Version

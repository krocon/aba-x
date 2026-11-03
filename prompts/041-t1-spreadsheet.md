# Prompt 041: ABA-T1 – Spreadsheet-App

> **Abhängigkeiten:** 032, 033 · **Aufwand:** L · **Betrifft:** Kern (Formeln, Abhängigkeitsgraph), Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-spreadsheet`. Design-Dokument: `prompts/041-t1-spreadsheet.design.md`.

## 1. Ziel

Tabellenkalkulation im Gerät: Raster (Spalten A…, Zeilen 1…, Größe festlegen), Navigation per Wippe/Touch,
Auswahl von Bereichen (Ziehen, Shift+Wippe), Zellinhalte **Zahl, Text, Formel** (`=A1+B1`, `=SUM(A1:A9)`),
relative/absolute Bezüge, Spalten-/Zeilenformeln (`=A1:A9^2` bzw. Formel für eine ganze Spalte), **Benennen** von
Zellen/Bereichen (Namen als Variablen in Start- und CAS-Ansicht), Kopieren/Einfügen (Wert/Formel/Format),
Füllen, Sortieren, Formatierung (Zahlformat, Ausrichtung, Farbe, Schrift), **CAS-Zellen** (exakte Ergebnisse),
externe Bezüge (`Spreadsheet.A1` aus anderen Apps), Import/Export CSV, Arbeitsblattfunktionen (Summe, Mittel,
Statistik, Regression über Bereiche).

## 2. Architektur und Bezug

- Vorbild Kap. 11 (Spreadsheet). Tabellenkomponente aus 032/033 (virtuelles Scrollen für große Blätter).
- Kern: Zellformel-Parser (Bezüge, Bereiche) auf Basis des bestehenden Parsers, **Abhängigkeitsgraph** mit
  inkrementeller Neuberechnung und **Zykluserkennung** (Fehler `#ZYKLUS`, nie Endlosschleife).

## 3. Umsetzung

1. Kern: Bezugs-Syntax (A1, $A$1, A1:B9, Namen), Auswertung mit Fehlerwerten je Zelle, Graph (Topologische
   Sortierung), Kopier-Semantik relativer Bezüge.
2. Frontend: Raster, Bearbeitungszeile (Textbuch-Eingabe), Format-Dialog, Menüleiste (Format, Name, Gehe zu,
   Auswahl, Sortieren, CAS ein/aus).
3. Persistenz (spärliche Speicherung), CSV über `FilesApi`.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Maximale Blattgröße und Speichermodell; Neuberechnung im Worker vs. Hauptthread.
- Formelsprache: an Vorbild/gängige Tabellenkalkulation angelehnt (Funktionsnamen, Trennzeichen je Sprache?).

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/sheet/{refs.ts,graph.ts,evaluate.ts}` + Cases
- `apps/aba-t1/src/app/apps/spreadsheet/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Bezüge kopieren (relativ/absolut), Zyklus A1→B1→A1, Fehlerfortpflanzung, Neuberechnung nur abhängiger Zellen
  (Zähler), Namen, CSV-Round-Trip.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Tabelle mit Formeln anlegen, Spalte füllen, Bereich benennen und in der Startansicht nutzen; Daten in Statistik
  2 Var übernehmen; Touch und Tastatur.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Diagramme im Blatt (Statistik-Apps nutzen), Import von Excel-Dateien.

## 7. Doku

- Hilfe (Formelsprache), `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Leistungsgrenzen (Zellen, Neuberechnungszeit)

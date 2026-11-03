# Design 041 – ABA-T1: Tabellenkalkulation

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 Kern rein in `packages/math/src/sheet/` (Bezüge, Formel-Compiler auf dem Text-Parser,
  Abhängigkeitsgraph, Blatt), App nur Verdrahtung · E2 spärliche Speicherung (`A1` → Eingabe + Format), Blatt höchstens
  A…ZZ × 9999 (702 × 9999 Zellen adressierbar) · E3 Neuberechnung inkrementell im Hauptthread (nur geänderte Zellen
  und ihre Abhängigen, topologisch sortiert, Zyklus → `#CYCLE!` je Zelle) – kein Worker, siehe Leistung · E4 Formelsprache
  wie gängige Tabellenkalkulationen: `=` am Anfang, Funktionsnamen englisch (SUM, AVERAGE, IF …, Groß/klein egal),
  Argumente mit `,`; beim Dezimalkomma `;` (Kern unterstützt beides, die App nutzt den Dezimalpunkt; CSV mit `;`
  liest/schreibt das Komma) · E5 Namen: Blattnamen werden nach jeder Änderung als Variablen der Startansicht gespeichert
  (Kopie des Werts, Liste bzw. Matrix bei Bereichen); umgekehrt lesen Formeln Startvariablen über ihren Namen
  (`Sheet.setVariables`, Blattnamen haben Vorrang, nur die betroffenen Formeln rechnen neu) · E6 Ansicht = Num-Ansicht
  der App (Start `num`), Fenster folgt dem Cursor statt nativem Scrollen (konstante DOM-Größe, Blattgröße egal) ·
  E7 Zustand der App = `SheetJSON` + Spaltenbreiten + CSV-Optionen (App-Zustand, wird mit der Bibliothek gespeichert)

## Umsetzung

- Kern (`@aba/math/sheet`, Prompt-041-Kern, 103 Specs): `refs.ts` (A1, $A$1, A1:B9, A:C, 3:5, Verschieben, Einfügen/
  Löschen), `formula.ts` (Eingabe → Zahl/Text/Formel, Kompilieren mit Platzhaltern, Kopier-Semantik), `graph.ts`
  (Abhängigkeiten, betroffene Zellen, Reihenfolge, Zyklen), `evaluate.ts` (Bezüge als Wert/Liste/Matrix, SUM … IF lazy,
  Fehlerwerte), `sheet.ts` (Blatt, Namen, Kopieren/Einfügen/Füllen, Zeilen/Spalten, Sortieren, CSV, JSON). Neu hier:
  `EvalContext.variable` und `Sheet.setVariables` (Startvariablen in Formeln) mit Spec.
- App `apps/aba-t1/src/app/apps/spreadsheet/`: `sheet-logic.ts` (Zustand, Cursor/Auswahl, Fenster, Formate, Namen →
  Start, Spalten → Listen; 9 Specs), `sheet-views.ts` (`SheetNum`, `SheetNumSetup`).
- Bedienung: Wippe bewegt, ⇧ + Wippe / Auswahl (F5) / Ziehen markiert, Spaltenkopf wählt die Spalte, Tippen wählt die
  Zelle, Doppeltippen = Bearbeiten; Zeile + Enter speichert (Zahl, Text, `=`-Formel) und rückt nach unten (Tab rechts);
  nicht leere Zeile + Wippe speichert und rückt in diese Richtung; ⌫/Entf in leerer Zeile leert die Auswahl; ⇧View/
  ⇧Menu (Mod+⇧C/V) kopieren/fügen ein. Menü: Bearb., Format (Zahlformat Standard/fest 2/wiss. 3, Ausrichtung, fett,
  kursiv, Farbe, Format löschen, Spalte breiter/schmaler), Name (Zeilentext benennt die Auswahl; leere Zeile: Namen
  anspringen/löschen), Gehe zu (Zelle, Bereich, Name), Auswahl, Mehr (Kopieren, Einfügen alles/Werte/Formeln/Formate,
  nach unten/rechts füllen, leeren, sortieren auf/ab nach der Cursorspalte – ohne Auswahl die ganze Tabelle –, Zeilen/
  Spalten einfügen/löschen, Spalten → L1, L2 …, CSV importieren/exportieren). Statuszeile: Eingabe der Zelle bzw.
  Fehlertext. ⇧Num: Standardbreite, CSV-Trennzeichen (`,` / `;` mit Dezimalkomma), CSV-Inhalt (Werte / Formeln).
- CSV über `FilesApi` (Desktop: Dialog + Rust, Web: Download / Dateiauswahl), Import ab der Cursorzelle.

## Leistung (Node, M-Klasse-Mac)

10 000 Zellen (5 000 Zahlen + 5 000 Kettenformeln) setzen ≈ 80 ms; Änderung am Kettenanfang (5 000 Abhängige) ≈ 20 ms,
am Ende (1 Abhängige) < 0,1 ms; `=SUM(B:B)` über 5 000 Zellen ≈ 2 ms; JSON-Rundreise (285 kB) ≈ 70 ms. Damit reicht
der Hauptthread; gespeichert wird nach jeder Änderung das ganze Blatt (bei sehr großen Blättern spürbar).

## Bewusst weggelassen (dokumentiert)

- **CAS-Zellen** (exakte Ergebnisse) und **externe Bezüge** `Spreadsheet.A1` aus anderen Apps: der Kern rechnet
  numerisch; Brücke zum CAS-Worker und App-übergreifende Bezüge wären ein eigener Schritt.
- **Spalten-/Zeilenformeln als eigene Objekte** (Formel für eine ganze Spalte): ersetzt durch Kopfzeile wählen +
  „nach unten füllen“ (füllt bis zum Ende des benutzten Bereichs) und Bereichsformeln wie `=A1:A9^2` (Liste).
- **Statistik 2 Var**: direkte Übernahme fehlt (App entsteht parallel); Brücke über „Spalten → L1, L2 …“.
- Hintergrundfarben, Schriftarten, Format-Dialog als eigene Ansicht (stattdessen Pop-up-Liste mit Voreinstellungen),
  Rückgängig, Regressionsfunktionen im Blatt, virtuelles Scrollen mit Bildlaufleiste (Fenster folgt dem Cursor, Mausrad
  verschiebt es).
- Blattnamen in der Startansicht sind Kopien (aktualisiert bei jeder Blattänderung, solange die Tabelle offen ist);
  das Löschen eines Namens lässt die Startvariable stehen. Im Lehrbuch-Modus tippt MathLive mehrbuchstabige Namen als
  Einzelbuchstaben – dort einbuchstabige Namen oder Algebraisch verwenden.

## Tests

- Kern: 103 Specs in `packages/math/src/sheet/` (Bezüge kopieren relativ/absolut, Zyklus A1→B1→A1, Fehlerfortpflanzung,
  Neuberechnung nur Abhängiger mit Zähler, Namen, CSV-Rundreise, Startvariablen).
- App: `sheet-logic.spec.ts` (9). E2E `spreadsheet` (Chromium): 2, 3, `=A1+A2` → 5; `=A1*10` nach unten füllen → 50;
  Zyklus → `#CYCLE!`; A3 als `T` benennen, Startansicht `T*2` → 10; axe auf der Tabelle ohne ernste Verstöße.

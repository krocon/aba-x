# ABA-T1 – Bedienung und Stand

> Zweiter Rechner im Monorepo (ADR 0008), Bedienkonzept nach dem HP Prime G2 (Vision:
> [`prompts/000-ABA-T1-Master-Prompt.md`](../prompts/000-ABA-T1-Master-Prompt.md)). Diese Seite wächst mit jedem
> Prompt (025–048); Fortschritt in [`roadmap.md`](roadmap.md).

## Gerät (025/026)

- Display fest 4:3 mit Titelzeile (Ansicht, Annunciators ⇧, A/a, 🔒, später RAD/DEG) und sechs Touch-Menütasten.
- Tasten oben: Apps (⇧ Info), ⌂ Home (⇧ Settings), Symb/Plot/Num (⇧ Setup), Wippe, Help (⇧ User), Esc (⇧ Clear),
  View (⇧ Copy), CAS (⇧ Settings), Menu (⇧ Paste).
- Shift wirkt auf die nächste Taste; Alpha einmal = ein Buchstabe, zweimal = gesperrt, dreimal = aus; Shift + Alpha
  = Kleinbuchstaben; Esc löst Shift und Alpha. Shift + On = Aus (Display dunkel), On = wieder an.
- Wippe: Klick bewegt einmal, Halten wiederholt. Display: Tippen, Doppeltippen, langes Drücken, Ziehen, Wischen,
  Zwei-Finger-Pinch (Maus, Stift und Finger gleich).

## PC-Tastatur

Ziffern, `+ - * / ^ ( ) , .`, Leertaste, Enter, Backspace (Entf = Del), Esc (⇧Esc = Clear), Pfeiltasten (= Wippe,
mit ⇧ = Wippe mit Shift) und Buchstaben (= Alpha-Zeichen) wirken wie die Gerätetasten, solange kein Eingabefeld den
Fokus hat. Dazu (`Mod` = ⌘ auf macOS, sonst Strg; gleich auf allen Systemen):

| Kürzel          | Taste             | Kürzel         | Taste              |
| --------------- | ----------------- | -------------- | ------------------ |
| F1–F6           | Menütasten 1–6    | F7 / ⇧F7       | Symb / Symb-Setup  |
| F8 / ⇧F8        | Plot / Plot-Setup | F9 / ⇧F9       | Num / Num-Setup    |
| F10 / ⇧F10      | Help / User       | Alt+A / Alt+⇧A | Apps / Info        |
| Alt+H / Alt+⇧H  | Home / Settings   | Alt+K / Alt+⇧K | CAS / CAS-Settings |
| Alt+M           | Menu              | Alt+W          | View               |
| Alt+T / Alt+⇧T  | Toolbox / Mem     | Alt+V / Alt+⇧V | Vars / Chars       |
| Alt+P / Alt+⇧P  | Vorlagen / Units  | Alt+X / Alt+⇧X | x,t,θ,n / Define   |
| Mod+⇧C / Mod+⇧V | Copy / Paste      | Alt+S / Alt+L  | Shift / Alpha      |
| Alt+O / Alt+⇧O  | On / Off          | Mod+/          | Tastaturübersicht  |

Alt-Kombinationen werden über `event.code` erkannt (macOS-Sonderzeichen mit ⌥ stören nicht). Strg+H/⌘H, ⌘K usw.
sind bewusst nicht belegt (Browser/OS).

## Startansicht (027)

- Verlauf: Eingabe links, Ergebnis rechts, neueste unten; Wippe ↑/↓ (oder ↑ in leerer Zeile, Wischen) wählt einen
  Eintrag, Enter bzw. „Kopie“ übernimmt das Ergebnis in die Eingabezeile, „Zeigen“ vergrößert ihn, Tippen wählt,
  zweites Tippen kopiert. Enter in leerer Zeile wiederholt die letzte Eingabe. ⇧Esc (Clear) leert den Verlauf nach
  Rückfrage. On bricht eine laufende Rechnung ab.
- Eingabe **Lehrbuch** (MathLive, Vorlagen-Taste mit 16 Strukturen) oder **Algebraisch** (Textzeile); RPN folgt (028).
- Rechnet numerisch im Worker mit reellen und komplexen Zahlen (`@aba/math/value`): `i` geht immer; reelle Funktionen
  liefern komplexe Ergebnisse (√−4 = 2i, ln −1, arcsin 2) nur mit „Komplexe Ergebnisse“ an – sonst die Meldung
  „the result is complex (complex results are off)“. tan 90°, 0⁻¹ usw. bleiben Fehler (kein geratenes Ergebnis).
- Variablen: `Ausdruck ▶ A` (⇧EEX = Sto ▶), `A := Ausdruck`, beliebige freie Namen; Funktionen `f(x) := …`; `Ans`
  (⇧+). Ein einfaches `=` ist ein Test (1/0), Vergleiche mit 12-stelliger Toleranz.
- Einstellungen (⇧Home): Winkelmaß, Zahlenformat (Standard = bis 12 signifikante Stellen, wissenschaftlich außerhalb
  10⁻⁶ ≤ |x| < 10¹²; Fest/Wissenschaftlich/Technisch mit 0–11 Stellen), Dezimalpunkt/-komma, komplexe Ergebnisse
  (aus, a+b·i, r∠θ), Eingabe, Sprache, Schriftgröße. Annunciator RAD/DEG.
- Gespeichert (Desktop: App-Datenordner, Web: IndexedDB `aba-t1`): Verlauf (200), Variablen, Funktionen, Einstellungen.

## RPN (028)

Einstellung „Eingabe: RPN“ zeigt statt des Verlaufs den Stack (Ebene 1 unten, eigener Speicher `rpn`). Enter legt die
Zeile ab (leere Zeile: DUP), ⌫ in leerer Zeile = DROP, Operatoren und Funktionen (auch ⇧-Funktionen, `!`, `1/x`, `|x|`,
`ʸ√x` mit x auf Ebene 2) wirken sofort; eine nicht leere Zeile wird vorher abgelegt. Menü: Sto ▶ (Name eintippen,
speichert Ebene 1, die bleibt), SWAP, DROP, DUP. Ebene mit Wippe ↑/↓ wählen: PICK, ROLL, ROLLD, DROPN, ECHO (Wert in
die Zeile); Enter = ECHO, Esc hebt die Auswahl auf. ⇧Esc leert den Stack nach Rückfrage. Kein Rückgängig.

## CAS (029)

Taste CAS (Alt+K): eigener Verlauf mit exakten Ergebnissen; ⇧CAS = CAS-Einstellungen (exakt/Näherung, Zahlenformat).
Enter rechnet exakt, ⇧Enter bzw. „≈“ als Dezimalwert. Menü: Sto ▶, Vereinfachen (umschließt die Zeile), ≈, Kopie,
Einfügen. ⇧View kopiert ein Ergebnis (Start- oder CAS-Ansicht), ⇧Menu fügt es in der anderen Ansicht ein. Befehle und
Abdeckung: [`mathematics/cas-aba-t1.md`](mathematics/cas-aba-t1.md). Markierungen: ≈ Näherung, ? nicht numerisch geprüft.

## Toolbox, Vars, Zeichen, Hilfe (030)

- **Toolbox** (Alt+T): Menütasten Math · CAS · App · Nutzer · Katalog · Hilfe. Wippe/Pfeile wählen, → oder Enter
  öffnet eine Kategorie, ← zurück, Enter fügt den Befehl als Vorlage in die Eingabezeile der Ansicht darunter ein;
  Ziffern 1–9 wählen die n-te Zeile, ein Alpha-Buchstabe springt im Katalog. Help zeigt Syntax, Erklärung (DE/EN)
  und ein Beispiel („Beispiel“ fügt es ein).
- **Vars** (Alt+V): Variablen und Funktionen der Start- und der CAS-Ansicht mit Wert. **Zeichen** (⇧Vars):
  griechische Buchstaben, ≤ ≥ ≠ ∞ ° ± → ∠ % ! …
- **Help** (F10) ohne Auswahl: Hilfe zur aktuellen Ansicht. Alle Hilfetexte sind eigene Texte (`help-data.ts`); eine
  Spec prüft, dass jeder Katalogbefehl Hilfe in beiden Sprachen und ein parsbares Beispiel hat.

## Einheiten, Konstanten, Basen (031)

⇧Vorlage (Units): Einheiten nach 17 Kategorien und Konstanten (CODATA 2022) – Einfügen als `\mathrm{\_km}` bzw.
Wert × Einheit. ⇧− (Base): Literale `#…h/b/o/d` und Bit-Funktionen. Einstellungen: Ganzzahl-Basis, Wortbreite,
Vorzeichen. Details: [`mathematics/units.md`](mathematics/units.md).

## Listen und Matrizen (032)

⇧7 Listenkatalog (L0–L9), ⇧4 Matrixkatalog (M0–M9): Enter öffnet den Tabelleneditor (Wippe bewegt, Eingabe +
Enter speichert und rückt weiter, über das Ende hinaus wächst die Tabelle; Menü: Bearb., +Zeile, −Zeile, +Spalte,
−Spalte, OK). ⇧8 `{ }`, ⇧5 `[ ]`. Getippte Katalogwörter (`sumlist(`, `det(`) und Namen `L1`, `M1` werden erkannt;
dafür ersetzen Start- und CAS-Ansicht MathLives eigene Kürzel. Details: [`mathematics/linalg.md`](mathematics/linalg.md).

## Apps (033)

Apps-Taste (Alt+A): App-Bibliothek mit eigenen Symbolen; Wippe/Touch wählen, Enter/Start öffnet. Menü: Speich.
(Kopie unter neuem Namen), Zurücks., Sortier. (Name / zuletzt benutzt), Löschen (nur Kopien). Jede App hat
Symb (F7), Plot (F8), Num (F9) und deren Einstellungen (⇧), ⇧Apps = Info-Notiz. Der Zustand jeder App (auch jeder
Kopie) wird gespeichert. Erste App: **Funktion** (F1…F9, F0 mit Häkchen und Farbe, Plot mit Ziehen/Pinch/
Doppeltippen/+−/Wippe, Tabelle mit Startwert/Schritt, Plot- und Tabellen-Einstellungen).

## Funktionen-App (034)

Plot: **Trace** (an/aus) folgt der gewählten Kurve (←→ ein Pixel, mit ⇧ zehn, ↑↓ wechselt die Kurve; ohne Trace
freier Fadenkreuz-Cursor), **Zoom** (vergrößern/verkleinern, X/Y einzeln, quadratisch, Autoskalierung, dezimal,
ganzzahlig, trigonometrisch, Standard, rückgängig), **Gehe zu** (X eingeben), **Fcn** (Nullstelle, Schnittpunkt,
Steigung, Extremum – jeweils nächstgelegen zum Cursor im sichtbaren Bereich; Fläche mit Vorzeichen: Start am
Cursor, zur zweiten Grenze gehen, Enter; Tangente gestrichelt), **Def.** (Definition in der Statuszeile),
**Ansicht** bzw. View-Taste (geteilt Grafik + Tabelle, Autoskalierung, Dezimal, Ganzzahl, Trig, PNG-Export).
Tippen setzt den Cursor, Ziehen verschiebt, Pinch und +/− zoomen, Doppeltippen vergrößert. Plot-Einstellungen:
Bereich, Raster, Achsen, Beschriftung, Zeichenmethode (adaptiv mit Sprungerkennung, Segmente, Punkte).

## Parametrisch, Polar, Folge (035)

Drei Apps mit gemeinsamen Ansichten: **Parametrisch** X1(T)/Y1(T) … (T-Bereich und -Schritt im Plot-Setup),
**Polar** R1(θ) … (θ im eingestellten Winkelmaß), **Folge** U1(N) … mit Startgliedern U1(1), U1(2) – explizit oder
rekursiv bis zur Ordnung 2, auch über andere Folgen; Selbstbezug wird gemeldet. Symb: ←→ wählt das Feld, x,t,θ,n
fügt die Variable ein. Plot: Trace über den Parameter (←→ ein Schritt, mit ⇧ zehn, ↑↓ wechselt die Kurve), Zoom,
Gehe zu, Def., PNG; Folgen als Treppe oder Spinnennetz (für U(N) = g(U(N−1))). Num: Tabelle über T, θ oder N.
Hinweis: ein Tippen im Display klickt jetzt das getroffene Element; nur Ziehen und Pinch fangen den Zeiger.

## Notizen, Speicher, Sicherung, Menü (045)

- **Notizen** (⇧0): Liste, Editor und formatierte Ansicht; Formatierung `# Überschrift`, `- Liste`, `**fett**`,
  `*kursiv*`, `` `Code` ``, `$Formel$` (LaTeX) – als Daten gerendert, nie als HTML. Export als Markdown.
- **Speicher** (⇧Toolbox): Verlauf, Variablen/Funktionen, Listen, Matrizen, RPN, CAS, Apps, Notizen mit Anzahl und
  Größe; „Löschen“ nach Rückfrage.
- **Sicherung**: Menü Datei › Sicherung exportieren (Mod+S) schreibt alle Dokumente als `aba-t1-backup-<Datum>.json`;
  Importieren (Mod+O) prüft Format und Version, zeigt die ersetzten Teile und lädt danach alles neu. Einzelne Apps
  (Bibliothek › Export, Datei › App importieren) und Notizen (Datei › Notiz importieren) als eigene Dateien.
- **Menü**: Datei, Bearbeiten (Desktop), Ansicht, Hilfe – nativ in der Desktop-App (übersetzt), als HTML-Menü über dem
  Gerät im Web; Über ABA-T1.

## Explorer (040)

Linear-, Quadratik- und Trig-Explorer: Die Gleichung läuft beim Verschieben mit (Normalform, Scheitel,
Diskriminante, Nullstellen bzw. Amplitude, Periode, Verschiebung). Menütasten oder ←→ wählen den Parameter, ↑↓ oder
+/− ändern ihn auf seinem Raster, Ziehen verschiebt den Graphen. **Üben**: Ein zufälliger Graph (gestrichelt, aus einem
Startwert reproduzierbar) soll getroffen werden; Enter/Prüfen vergleicht die Graphen (nicht die Parameter), Punkte in
der Titelzeile.

## 3D-Grafik (046)

FZ1(X,Y) … in Symb; Plot als schattierte Fläche mit Höhenfarben (Canvas 2D, Maler-Algorithmus – kein WebGL nötig, in
allen WebViews gleich), Ziehen/Wippe dreht, Pinch/+/− zoomt, Box an/aus, Ansicht zurücksetzen; ⇧Plot: X-, Y-, Z-Bereich
und Gitter (5–80). Undefinierte Stellen und Werte außerhalb des Z-Bereichs bleiben Lücken. Num: Werte auf einem 5×5-Raster.

## Erweiterte Grafiken (036)

V1 … V0 sind Relationen in X und Y: Gleichungen (`X²+Y²=9`), Ungleichungen (`Y>sin(X)`) und Verknüpfungen
`and(…)`, `or(…)`, `not(…)`, `xor(…)`. Beim Bearbeiten fügt das Menü X, Y, ≤, ≥ und die Verknüpfungen ein. Plot rechnet mit
Intervallarithmetik: gefärbt ist nur, wo die Relation sicher gilt; grau, wo es sich nicht entscheiden lässt; gestrichelte
Ränder gehören nicht dazu. ←→ verfolgt einen Rand, ↑↓ wechselt die Relation, Galerie lädt Beispiele. Num listet je X die
Rand-Y-Werte im Y-Bereich (numerisch). Bricht die Verfeinerung am Zeitbudget ab, sagt die Statuszeile das.

## Statistik 1Var und 2Var (037)

Num enthält zehn Datenspalten (D1…D0 bzw. C1…C0): Wert tippen, Enter speichert und geht weiter; Sortieren, Mehr
(absteigend, leeren, 20 Zufallswerte, aus/nach Listen L0…L9 kopieren) und Stats (alle Kennzahlen je Analyse). Symb legt
bis zu fünf Analysen an – 1Var: Daten- und Häufigkeitsspalte und Diagramm (Histogramm, Boxplot, Normalwahrscheinlichkeit,
Linie, Säule, Pareto, Kontrollkarte, Punkt, Stamm-Blatt, Kreis); 2Var: X, Y und Anpassung (linear, logarithmisch,
exponentiell, Potenz, Exponent, invers, logistisch, quadratisch, kubisch, quartisch, trigonometrisch). Plot: ←→ verfolgt
Klassen oder Punkte, ↑↓ wechselt die Analyse, Auto passt die Ansicht an, Tippen wählt den nächsten Punkt; 2Var: Pred Y
und Pred X. ⇧Plot: Ansicht, Histogramm-Klassen, Raster, Achsen. Definitionen: `docs/mathematics/statistics.md`.

## Inferenz und Verteilungen (038)

Startansicht/Toolbox → Math → Wahrscheinlichkeit: `normalpdf`, `normalcdf` (P(X ≤ x)), `invnorm` und dieselbe Form für t,
χ², F, Exponential, Gleichverteilung, Binomial, Poisson, Geometrisch; Zufall mit `random`, `randint`, `randnorm`,
`randbin`, `randseed`. Inferenz-App: Symb wählt Verfahren, Alternative und Poolen; Num nimmt die Eingaben (Import von
x̄, s, n aus Statistik 1Var) und zeigt Entscheidung, Teststatistik, P, kritische Werte bzw. das Intervall; Plot zeigt
die Verteilung mit schattiertem Bereich. Details: `docs/mathematics/distributions.md`.


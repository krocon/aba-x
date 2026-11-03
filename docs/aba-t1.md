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

| Kürzel | Taste | Kürzel | Taste |
|---|---|---|---|
| F1–F6 | Menütasten 1–6 | F7 / ⇧F7 | Symb / Symb-Setup |
| F8 / ⇧F8 | Plot / Plot-Setup | F9 / ⇧F9 | Num / Num-Setup |
| F10 / ⇧F10 | Help / User | Alt+A / Alt+⇧A | Apps / Info |
| Alt+H / Alt+⇧H | Home / Settings | Alt+K / Alt+⇧K | CAS / CAS-Settings |
| Alt+M | Menu | Alt+W | View |
| Alt+T / Alt+⇧T | Toolbox / Mem | Alt+V / Alt+⇧V | Vars / Chars |
| Alt+P / Alt+⇧P | Vorlagen / Units | Alt+X / Alt+⇧X | x,t,θ,n / Define |
| Mod+⇧C / Mod+⇧V | Copy / Paste | Alt+S / Alt+L | Shift / Alpha |
| Alt+O / Alt+⇧O | On / Off | Mod+/ | Tastaturübersicht |

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

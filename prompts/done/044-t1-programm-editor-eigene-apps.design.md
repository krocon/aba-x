# Design 044 – ABA-T1: Programmeditor, Debugger, eigene Apps, Nutzertasten

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen:
  - E1 **Editor:** eigene leichte Lösung statt CodeMirror 6 – ein normales `<textarea>` (volle Hardware-Tastatur,
    Bildschirmleser, Touch, Auswahl/Kopieren des Systems) über einer hervorgehobenen Kopie aus dem Tokenizer von
    `@aba/ppl`; keine neue Abhängigkeit. Automatische Einrückung (Enter, nach BEGIN/THEN/DO/REPEAT/ELSE zwei mehr),
    Tab, „Einrück.“ ordnet das ganze Programm, Vorlagen-Menü, Prüfen springt zum ersten Fehler, Suchen/Ersetzen.
  - E2 **Debugger:** Granularität **Zeile** (der Interpreter meldet jede Anweisung, gehalten wird einmal je Zeile);
    Haltepunkte per Zeilennummer, Schritt, Weiter, Stopp, Variablen der laufenden Funktion; Laufzeitfehler setzen den
    Cursor an ihre Stelle.
  - E3 **Sicherheit:** Programme (auch aus Dateien) laufen nur im Interpreter gegen die Host-Schnittstelle – kein
    DOM-, Netz- oder Dateizugriff, Schritt-/Zeit-/Rekursionsbudget, On bricht ab (Design 043 E4).
  - E4 **Eigene Apps:** ein Programm mit dem Namen der App (ohne Leer-/Sonderzeichen, „My Fn“ → `MyFn`) passt sie an:
    exportierte `START` (beim Start), `RESET` (beim Zurücksetzen), `SYMB`, `PLOT`, `NUM` (statt der Ansicht); Ausgaben
    erscheinen im Terminal. App-Kopien (033) + Programm = eigene App.
  - E5 **Nutzertasten:** ⇧Help schaltet Nutzermodus einmalig (1U), zweimal dauerhaft (U), dreimal aus; eine Taste ruft
    die exportierte Funktion `K_<Tasten-Id>` (geshiftet `K_<Id>_S`, z. B. `K_SIN`, `K_D7_S`) und zeigt ihr Ergebnis in der
    Startansicht. Statt eines eigenen `KEY`-Schlüsselworts reichen damit normale exportierte Funktionen.
  - E6 Katalog: Programme als ein versioniertes Dokument (`programs`), Export/Import als Textdatei über `FilesApi`
- Weggelassen: eigene Menüleisten und `VIEW`-Ansichten von App-Programmen, Import von Original-Programmdateien
  (ausdrücklich ausgeschlossen), Debugger-Haltepunkte über Programmgrenzen hinweg

## Fortschritt

- [x] Katalog (Neu, Bearbeiten, Umbenennen, Löschen, Kopieren, Export/Import, Start) · [x] Editor · [x] Debugger
- [x] App-Programme (START/RESET/SYMB/PLOT/NUM) · [x] Nutzertasten · [x] Hilfe DE/EN
- [x] Specs (Editor-Logik 4, Programme 5) · [x] E2E (Programm schreiben, prüfen, mit Argument starten, Terminal;
      Haltepunkt mit Variable; Nutzertaste; START eines App-Programms)

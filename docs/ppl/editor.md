# Programme in ABA-T1: Katalog, Editor, Debugger, eigene Apps, Nutzertasten

## Katalog (⇧1)

Bearbeiten, Neu, Umbenennen, Löschen, Mehr (Kopieren, Export in eine Textdatei, Import aus einer Textdatei, Terminal),
Start (erste exportierte Funktion; Argumente werden abgefragt). Programme mit Fehlern zeigen Zeile:Spalte.

## Editor

- Hardware-Tastatur wie in jedem Textfeld; virtuelle Tasten fügen ihren Text ein, die Wippe bewegt den Cursor.
- Enter übernimmt die Einrückung (zwei Leerzeichen mehr nach BEGIN, THEN, DO, REPEAT, ELSE), Tab rückt ein,
  „Einrück.“ richtet das ganze Programm neu aus.
- Prüfen springt zum ersten Syntaxfehler; die Statuszeile zeigt ihn dauerhaft.
- Vorl.: Blöcke (EXPORT, IF, CASE, FOR, WHILE, REPEAT …) und Befehle (PRINT, INPUT, Grafik) an der Cursorstelle.
- Suchen (Enter = nächster Treffer) und Ersetzen (alle, ohne Groß-/Kleinschreibung).

## Debugger

Zeilennummer antippen = Haltepunkt an/aus. Debug startet die erste exportierte Funktion: mit Haltepunkten läuft sie bis
zum nächsten, sonst hält sie an der ersten Zeile. Schritt (oder Enter) geht zur nächsten Zeile, Weiter bis zum nächsten
Haltepunkt, Stopp bricht ab. Die Variablen der laufenden Funktion stehen unter dem Quelltext.

## Eigene Apps

Eine App kopieren (Bibliothek → Speichern unter), dann ein Programm mit ihrem Namen ohne Leer- und Sonderzeichen anlegen.
Exportierte Funktionen ohne Parameter: `START` (beim Start), `RESET` (beim Zurücksetzen), `SYMB`, `PLOT`, `NUM`
(ersetzen die Ansicht; Ausgaben im Terminal).

## Nutzertasten

⇧Help: Nutzermodus für eine Taste (1U), nochmal: dauerhaft (U), nochmal: aus. Eine Taste ruft dann die exportierte
Funktion `K_<Taste>` (geshiftet `K_<Taste>_S`), z. B. `EXPORT K_SIN() BEGIN RETURN 42; END;`. Tasten-Ids stehen in der
Tastaturhilfe (Fußzeile „Keyboard“).

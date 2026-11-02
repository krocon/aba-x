# ADR 0006 – Bedienoberfläche als Rechner-Gerät

- Status: angenommen · Datum: 02.11.2026 · Vorgabe: Marc (Referenzbilder eines HP-48/50-Emulators)

## Kontext
Master-Prompt §5.1 schlug ein schlichtes App-Layout vor. Marc wünscht „vom Look her so was“ wie einen klassischen
Grafikrechner: LCD mit Stack-Ebenen, invertierte Softkey-Leiste, sechs weiße Softkeys, dunkles Tastenfeld mit
farbigen Shift-Beschriftungen. Am PC soll die Hardware-Tastatur voll nutzbar sein.

## Entscheidung
Die App zeigt ein **eigenständiges** Rechner-Gerät (`CalculatorDevice`): LCD (Annunciators, Pfad `{ MODUS }`,
Stack 4…1, Eingabezeile, Softmenü), F1–F6-Softkeys (Moduswahl und spätere Menüs), Tastenfeld 6 + 5 Spalten mit
Links-Shift (violett) und Rechts-Shift (türkis), Alpha-Buchstaben. Eigene Tastenbelegung, eigene Farben, kein
Herstellername/Logo, keine kopierten Grafiken (Master-Prompt §5.3, §10). Das Display hat eine feste Größe, damit
das Tastenfeld nie springt. Hardware-Tastatur: Tippen geht in die Eingabezeile, `Enter` = ENTER, `Esc` = Zeile
leeren, `F1`–`F6` = Softkeys, die passende virtuelle Taste leuchtet kurz auf.

## Folgen
+ Starke, wiedererkennbare Identität; Tastatur- und Mausbedienung gleichwertig. − Auf sehr kleinen Displays eng
(375 px geprüft). − Die Gerätefarben sind bewusst fest (wie ein physisches Gerät), nur die Seite folgt hell/dunkel.

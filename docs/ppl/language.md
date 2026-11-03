# Programmiersprache von ABA-T1 (`@aba/ppl`)

Eine strukturierte, Pascal-artige Sprache. Schlüsselwörter sind unabhängig von Groß-/Kleinschreibung, Variablen nicht;
Funktionsnamen (eigene, eingebaute, Katalog) ebenfalls nicht. Kommentare mit `//`.

## Grammatik (EBNF, vereinfacht)

```
program = { decl }
decl    = ["EXPORT"] id "(" [params] ")" ( ";" | "BEGIN" block "END" [";"] ) | "LOCAL" vars ";"
block   = { stmt ";" }
stmt    = "LOCAL" vars | id ["(" index {"," index} ")"] ":=" expr | expr | "RETURN" [expr]
        | "IF" expr "THEN" block ["ELSE" block] "END"
        | "CASE" { "IF" expr "THEN" block "END" ";" } ["DEFAULT" block] "END"
        | "FOR" id ("FROM" | ":=") expr ("TO" | "DOWNTO") expr ["STEP" expr] "DO" block "END"
        | "WHILE" expr "DO" block "END" | "REPEAT" block "UNTIL" expr | "BREAK" | "CONTINUE"
expr    : OR/XOR < AND < NOT < Vergleich (== = ≠ <> < > ≤ <= ≥ >=) < + − < * / MOD < unäres − < ^ < ! < primary
primary = Zahl | "Text" | id [ "(" args ")" ] | "(" expr ")" | "{" Liste "}" | "[[…],[…]]"
```

`LOCAL` auf oberster Ebene sind Programmvariablen (bei jedem Start neu belegt). Werte: Zahlen, komplexe Zahlen,
Einheiten, Listen, Matrizen, Texte. `==` vergleicht mit relativer Toleranz 1e-12 wie der Rechenkern.

## Eingebaute Befehle

Ausgabe und Dialoge: `PRINT` (ohne Argument: Terminal leeren), `MSGBOX`, `INPUT(var | {vars}, Titel, Beschriftungen,
Hilfen, Rücksetzwerte)`, `CHOOSE(var, Titel, Einträge…)`, `WAIT(s)` (0 = auf Taste warten), `GETKEY`, `ISKEYDOWN`.
Tastencodes: Position der Taste im Tastenfeld, oben links beginnend mit 0.

Grafik auf G0–G9 (320 × 240; `…_P` = Pixel, sonst kartesisch im Fenster X −16…16, Y −12…12): `RECT`, `LINE`, `PIXON`,
`TEXTOUT`, `FILLPOLY`, `BLIT`, Farben mit `RGB(r, g, b)`.

Texte und Listen: `DIM`, `SIZE`, `CONCAT`, `STRING`, `EXPR`, `LEFT`, `RIGHT`, `MID`, `INSTRING`, `UPPER`, `LOWER`,
`CHAR`, `ASC`, `TYPE`; Zahlen: `IP`, `FP`, `RANDOM`, `RANDINT`, `TICKS` und der ganze Funktionskatalog des Rechners.

## Grenzen

Schritte 1e8, Rechenzeit 30 s (Warten auf Eingaben zählt nicht), Rekursionstiefe 200, Texte bis 1e6 Zeichen, Listen bis
1e6 Einträge. On bricht ein laufendes Programm ab.

## Bewusste Abweichungen

AND/OR werten verkürzt aus; keine `#cas`-Blöcke; kein `▶`; keine verschachtelten Indizes `L(1)(2)`; FOR-Variable hat
nach der Schleife den ersten Wert hinter dem Ende; `LOCAL` gilt bis zum Ende der Funktion (kein Blockbereich).

Editor, Debugger, eigene Apps und Nutzertasten: [`editor.md`](editor.md).

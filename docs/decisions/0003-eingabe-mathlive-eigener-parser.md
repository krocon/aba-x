# ADR 0003 – Eingabe mit MathLive, LaTeX-Subset-Parser statt Compute Engine

- Status: angenommen · Datum: 02.11.2026 · Belege: `docs/technical-evaluation.md` §2, §4

## Entscheidung
MathLive (MIT) ist das Eingabefeld, lazy geladen, Fonts gebündelt, Sounds und eigene virtuelle Tastatur aus.
Die Weiterverarbeitung nimmt **LaTeX** (verlustfrei), nicht ASCII-Math (verlustbehaftet), und parst es mit einem
eigenen Parser für das von MathLive/unserer Tastatur erzeugte Subset in den eigenen AST. Die Compute Engine
(1,75 MB gzip) wird dafür nicht eingesetzt.

## Folgen
+ Kleines Bundle, volle Kontrolle über Fehlermeldungen mit Positionen. − Parser für `\frac`, `\sqrt[n]`, `\int`,
`\sum`, `\left|…\right|`, Matrizen u. a. muss selbst gebaut und gegen MathLive-Ausgaben getestet werden (Prompt 003).

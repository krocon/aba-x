# Design 005 – Auswertung im Standard-Modus

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen

- E1 **Exakt über das CAS** (Worker, `simplify`), numerisch parallel (`evaluateNumeric`) für „≈ …“ und als
  Rückfall, wenn das CAS eine Funktion nicht kennt (gcd, …). Eigene BigInt-Brüche sind damit unnötig.
- E2 Reelle Zahlen: ein geschlossener Ausdruck ohne reellen Wert (1/0, ln 0, arcsin 2, √−1) ist ein Fehler, auch
  wenn das CAS etwas Komplexes liefern würde; Überlauf bleibt exakt (10⁴⁰⁰).
- E3 Gradmaß: Umschreiben des AST (sin x → sin(x·π/180), arcsin x → arcsin(x)·180/π), CAS rechnet in Bogenmaß.
- E4 **RPN** bei leerer Zeile: + − × ÷ yˣ verknüpfen Ebene 2 und 1, Funktionstasten und +/− wirken auf Ebene 1;
  ENTER auf leerer Zeile dupliziert; →NUM (⇧▶ ENTER) wandelt in eine Dezimalzahl.
- E5 Tasten während einer Rechnung werden gepuffert und danach in Reihenfolge ausgeführt; ON/Esc bricht ab.
- E6 Darstellung: `prettify` bringt CAS-Ausgaben in Lehrbuchform (√, Brüche statt negativer Exponenten,
  `x − 1` statt `−1 + x`); „≈ …“ unter nicht-ganzzahligen exakten Ergebnissen.
- Gleichungen im Standard-Modus → Hinweis auf CAS-Modus (010); Zuweisungen folgen mit 008.

## Fortschritt

- [x] Engine, Store, Display, Specs (inkl. echter CAS im Test), Browser (Chromium + WebKit) und macOS-App geprüft

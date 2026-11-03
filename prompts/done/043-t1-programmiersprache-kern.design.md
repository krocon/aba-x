# Design 043 – ABA-T1: Programmiersprache (Kern)

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen:
  - E1 **Paket `@aba/ppl`** (`packages/ppl`), framework-frei, ESLint-Sperre; den Mathe-Kern erreicht es nur über
    `src/math-bridge.ts` (Alias `@aba/math/…`). Eigene Vitest-Konfiguration, `pnpm test:ppl` in `pnpm test`.
  - E2 **Kompatibilität:** strukturierte Pascal-artige Sprache wie das Vorbild (EXPORT, LOCAL, :=, IF/CASE/FOR/WHILE/
    REPEAT, BREAK/CONTINUE, RETURN, Rekursion, Listen/Matrizen/Strings, A–Z); bewusste Abweichungen: AND/OR werten
    verkürzt aus, keine `#cas`-Blöcke (klare Syntaxfehlermeldung), kein `▶`, keine verschachtelten Indizes `L(1)(2)`,
    keine exportierten Variablen. Meldungen englisch. Grammatik: [`docs/ppl/language.md`](../../docs/ppl/language.md).
  - E3 **Interpreter:** AST-Walker; Ausdrücke ohne Nutzerfunktionen/Dialoge synchron, sonst asynchron; Budgets für
    Schritte (1e8), Rechenzeit (30 s, Wartezeit zählt nicht), Rekursionstiefe (200). Messung: 10⁶ Schleifendurchläufe
    ≈ 250 ms (Node) – Ziel < 1 s erfüllt.
  - E4 **Ausführung:** kooperativ im Haupt-Thread statt im Worker – der Interpreter gibt spätestens alle 20 ms an die
    Ereignisschleife ab, die Anzeige bleibt bedienbar, On bricht ab. Grund: INPUT/MSGBOX/CHOOSE/GETKEY/Grafik brauchen
    die Oberfläche; ein Worker-Protokoll hätte nur Nachrichten weitergereicht. Sicherheit: Programme sehen ausschließlich
    die Host-Schnittstelle (keine DOM-, Netz- oder Dateizugriffe, kein `eval`). Ein Worker bleibt möglich (der Host
    ist strukturiert klonbar).
  - E5 **Grafik:** Befehle als Objekte (`GfxCommand`), gezeichnet in zehn Canvas-Puffer G0–G9 (320 × 240), kartesisch im
    festen Fenster X −16…16, Y −12…12; das Terminal zeigt G0, wenn ein Programm gezeichnet hat.
  - E6 **Aufruf:** exportierte Funktionen werden in der Startansicht wie Funktionen geparst; vor der Auswertung im
    Rechen-Worker laufen Programmaufrufe (innen zuerst) und werden durch ihren Wert ersetzt. Toolbox → Nutzer listet sie.
- Weggelassen: `#cas`-Blöcke, Aufruf aus der CAS-Ansicht (die CAS-Engine kennt keine Programme), App-Variablen (nur
  Startvariablen und eigene Variablen)

## Fortschritt

- [x] Lexer/Parser/Interpreter/Builtins (95 Specs: Grammatik inkl. 15 Fehlerpositionen, Semantik, Beispielprogramme,
      Budgets, Abbruch) · [x] Einbindung (Alias, ESLint, Tests) · [x] Host: Variablen, Terminal, Dialoge, Tasten, Grafik
- [x] Startansicht ruft EXPORT-Funktionen auf, Toolbox → Nutzer · [x] E2E (FAK(6)+1 = 721, PRINT im Terminal, Abbruch mit On)

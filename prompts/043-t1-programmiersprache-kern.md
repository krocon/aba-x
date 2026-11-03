# Prompt 043: ABA-T1 – Programmiersprache: Kern (Parser, Interpreter)

> **Abhängigkeiten:** 027, 032 · **Aufwand:** L · **Betrifft:** neues Paket `packages/ppl`, Kern, Worker
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-programmiersprache`. Design-Dokument: `prompts/043-t1-programmiersprache-kern.design.md`.

## 1. Ziel

Eine an **HP PPL** angelehnte, strukturierte Programmiersprache (Pascal-artig), sodass typische Programme aus
Lehrmaterial mit wenig Anpassung laufen:

- `EXPORT name(args) BEGIN … END;`, lokale Variablen `LOCAL`, Zuweisung `:=`, Ausdrücke mit dem Funktionskatalog,
  `IF … THEN … ELSE … END`, `CASE`, `FOR i FROM a TO b [STEP s] DO … END`, `WHILE`, `REPEAT … UNTIL`,
  `BREAK`/`CONTINUE`, `RETURN`, Unterprogramme, Rekursion, Listen/Matrizen/Strings, Startvariablen A–Z und
  App-Variablen.
- Ein-/Ausgabe: `PRINT` (Terminal), `MSGBOX`, `INPUT` (Formular), `CHOOSE`, `WAIT`, `GETKEY`/`ISKEYDOWN`.
- Grafik: `RECT`, `LINE`, `PIXON`, `TEXTOUT`, `BLIT` auf G0–G9 (320 × 240 logisch) – mindestens Grundbefehle.
- `#cas … #end`-Blöcke (CAS-Funktionen) – soweit die Engine (029) es trägt.

## 2. Architektur und Bezug

- Vorbild Kap. 29 (Programmierung). Die Sprache wird **neu implementiert** (Syntax ist nicht geschützt, Texte und
  Beispiele aus dem Handbuch werden nicht übernommen).
- Neues framework-freies Paket `packages/ppl` (`@aba/ppl`), ESLint-Sperren wie `@aba/math`; nutzt `@aba/math` für
  Ausdrücke. Ausführung **im Worker** mit Schritt-/Zeitbudget, Abbruch (On), keine Blockade der UI.

## 3. Umsetzung

1. **Grammatik** (EBNF im Design), Lexer/Parser mit Fehlerpositionen (Zeile/Spalte, verständliche Meldungen DE/EN).
2. **Interpreter** (AST-Walker oder Bytecode – entscheiden) mit Umgebungen, Typen (Zahl, komplex, Liste, Matrix,
   String, Grafik), Laufzeitfehlern als Werte; Rekursionslimit.
3. **Ein-/Ausgabe-Protokoll** Worker ↔ UI (Nachrichten für `PRINT`, `INPUT`, `GETKEY`, Grafikbefehle).
4. **Exportierte Funktionen** erscheinen im Toolbox-Menü „Nutzer“ und sind in Start-/CAS-Ansicht aufrufbar.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Kompatibilitätsgrad zum Vorbild (welche Befehle, Abweichungen bewusst dokumentieren).
- Interpreter-Architektur und Leistungsziel (z. B. Schleife mit 10⁶ Iterationen < 1 s).
- Grafik-Pufferung (OffscreenCanvas im Worker vs. Befehlsliste an die UI).

## 4. Erwartete Dateien und Schnittstellen

- `packages/ppl/{package.json,src/lexer.ts,parser.ts,ast.ts,interpreter.ts,builtins/*,io-protocol.ts}` + Specs
- Aliase in `tsconfig.json`, ESLint-Sperren, Vitest-Konfiguration, `pnpm test` erweitert

## 5. Tests und Abnahmekriterien

**Tests**

- Grammatik-Fälle (gültig/ungültig mit Fehlerposition), Semantik (Gültigkeitsbereiche, Rekursion, Schleifen,
  Grenzen), Beispielprogramme (Primzahlsieb, Newton-Verfahren, Collatz), Endlosschleife → Abbruch per Budget.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Programm (vorerst als Testdatei/Entwicklerweg) definiert `EXPORT FAK(n)`; `FAK(5)` in der Startansicht → 120;
  `PRINT`-Ausgabe erscheint im Terminal; Abbruch mit On.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Programmeditor, Debugger, eigene Apps, Nutzer-Tastenbelegung (044); Python (047).

## 7. Doku

- `docs/ppl/` (Sprachreferenz, eigene Beispiele), ADR für das neue Paket, `CLAUDE.md` (Layout), `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Befehlsabdeckung (Tabelle) und Leistungsmessung; Review durch separaten Agenten (Parser, Sandbox/Abbruch)

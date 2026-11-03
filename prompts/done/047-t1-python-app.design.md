# Design 047 – ABA-T1: Python-App

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen:
  - E1 **MicroPython statt Pyodide:** `@micropython/micropython-webassembly-pyscript` 1.29.0-6 (MIT) – 450 kB WASM +
    110 kB JS gegenüber > 10 MB bei Pyodide; Start im Worker ≈ 20 ms nach dem Laden; Abbruch durch Beenden des Workers
    (On, Zeitlimit 60 s). Kein eigener WASM-Build: die Datei kommt unverändert aus dem npm-Paket (reproduzierbar über die
    Lock-Datei).
  - E2 **Laden:** `micropython.mjs` und `micropython.wasm` liegen als Assets unter `python/` (Service Worker: prefetch,
    also offline), der Worker lädt das Modul zur Laufzeit (`import()`), weil es Node-Rückfallpfade enthält, die ein
    Browser-Bundle nicht auflösen kann. Server: `.mjs` als `text/javascript`, `.wasm` als `application/wasm`;
    Tauri-CSP: `script-src 'wasm-unsafe-eval'`, `connect-src 'self'`.
  - E3 **Brücke:** `calc.get(name)` / `calc.set(name, wert)` über JSON (Zahlen, komplex als `{re, im}`, Listen,
    Matrizen); der Worker bekommt eine Momentaufnahme der Variablen, Gesetztes geht nach dem Lauf in die Startansicht.
    `graphic` (clear, pixel, line, rect, text, fill_poly, rgb) schickt dieselben Grafikbefehle wie die
    Programmiersprache (043) auf G0.
  - E4 **Shell:** eine Zeile wird wie in einer REPL ausgeführt (Wert eines Ausdrucks wird gezeigt); Zeilen während eines
    Laufs warten in einer Schlange. Skripte im App-Zustand (Symb), Editor mit Einrückung nach `:`; ein Fehler setzt den
    Cursor in seine Zeile. Lizenzen: `pnpm notices` (MicroPython im Hinweis der App).
- Weggelassen: Paketinstallation und Netzwerk (ausgeschlossen), `turtle`, Eingabe mit `input()` (die Shell hat keine
  stdin-Anbindung)

## Fortschritt

- [x] Worker mit MicroPython, Module `calc` und `graphic` · [x] Shell, Skripte, Plot G0, On/Zeitlimit · [x] Hilfe DE/EN
- [x] Specs (Brücke, Traceback, Einrückung) · [x] E2E (`print(sum(range(10)))` → 45, calc.set in die Startansicht,
      Fehler mit Zeile, Skript zeichnet, Endlosschleife mit On abgebrochen; offline über den Service Worker)

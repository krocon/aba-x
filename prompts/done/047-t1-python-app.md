# Prompt 047: ABA-T1 – Python-App (optional)

> **Abhängigkeiten:** 044 · **Aufwand:** M · **Betrifft:** Frontend, Worker, Abhängigkeiten/Lizenzen
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-python`. Design-Dokument: `prompts/047-t1-python-app.design.md`.

## 1. Ziel

Python-App wie in neueren Firmware-Versionen des Vorbilds: Python-Shell (REPL) und Skripte (Editor aus 044),
Module für Mathematik (`math`, `cmath`), Zufall, einfache Grafik (Zeichnen auf dem Display, z. B. eigenes Modul
`graphic`/`turtle`-ähnlich), Zugriff auf Gerätevariablen über ein Brückenmodul (lesen/schreiben von A–Z, Listen,
Matrizen), Abbruch mit On.

## 2. Architektur und Bezug

- Laufzeit im Worker als WebAssembly: **MicroPython** (MIT, klein) empfohlen vs. Pyodide (CPython, groß, viele
  Pakete). Offline-Fähigkeit: Laufzeit im Bundle bzw. Service-Worker-Cache, kein CDN.
- Editor/Katalog aus 044, Grafik-Ausgabe über das Protokoll aus 043.

## 3. Umsetzung

1. Laufzeit einbinden (Lazy Loading, Budget), Ein-/Ausgabe (stdin/stdout) über Worker-Nachrichten.
2. Brückenmodul zu Variablen und Grafik; Zeit-/Speicherbudget, Abbruch.
3. Python-App: Shell, Skriptkatalog, Ausführen.

### Entscheidungsfragen (im Design-Dokument beantworten)

- MicroPython vs. Pyodide (Größe, Startzeit, Lizenz, Abbruchbarkeit); Build der WASM-Datei reproduzierbar?
- `pnpm notices` für WASM-Bestandteile.

## 4. Erwartete Dateien und Schnittstellen

- `apps/aba-t1/src/app/apps/python/*`, Worker-Einstieg, ggf. `packages/core/src/compute/*` (zweiter Worker-Typ)

## 5. Tests und Abnahmekriterien

**Tests**

- Brückenmodul (Variablen lesen/schreiben), Abbruch einer Endlosschleife, Fehlerausgabe mit Zeilennummer.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- `print(sum(range(10)))` → 45 in der Shell; Skript zeichnet eine Linie; offline im Web-Build.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Paketinstallation zur Laufzeit, Netzwerkzugriff aus Python.

## 7. Doku

- `docs/architecture.md` (Laufzeit, Größe, Lizenz), Hilfe, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Bundle-Größe und Startzeit; Lizenzen

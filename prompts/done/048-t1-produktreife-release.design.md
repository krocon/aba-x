# Design 048 – ABA-T1: Produktreife und Release-Vorbereitung

- Status: umgesetzt (ohne Veröffentlichung) · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen:
  - E1 **Umfang 0.1.0:** alle Prompts 025–047 sind enthalten, auch die Kann-Prompts 040 (Explorer), 046 (3D) und 047
    (Python). Für 0.2 bleiben die in den Design-Dokumenten genannten Lücken (z. B. benutzerdefinierte Regression,
    CAS-Zellen der Tabellenkalkulation, Tangente an Funktionsgraphen in der Geometrie, eigene Menüleisten/`VIEW` von
    App-Programmen, `#cas` in Programmen).
  - E2 **Lazy Loading der Apps:** jede App-Ansicht ist ein eigener Chunk (`lazy()` in `app-registry.ts`, `AppHost`
    lädt bei Bedarf). Start-Bundle `main` 1,51 MB → 0,84 MB, initial gesamt 1,30 MB (≈ 349 kB übertragen);
    Budgets für ABA-T1 auf 1,4 MB (Warnung) / 2 MB (Fehler) gesenkt. MicroPython (560 kB) lädt erst beim ersten
    Python-Befehl.
  - E3 **Barrierefreiheit:** neues E2E-Szenario `accessibilitySweep` – axe über 14 Hauptansichten, hell und dunkel; Befunde
    behoben (Kontrast der aktiven Menütaste, fokussierbare Bildlaufbereiche in Toolbox, Listenkatalog, Speicher).
    Die App-Szenarien prüfen ihre eigenen Ansichten zusätzlich mit axe.
  - E4 **Web-Ziel (Vorschlag, Entscheidung Marc):** App unter `krocon.de/products/aba-t1/` (bereits `baseHref`),
    Produktseite unter `krocon.de/products/aba-t/` (wie ABA-X1: `aba-x` / `aba-x1`).
  - E5 **Screenshots:** `scripts/screenshots/aba-t1.mjs` (9 Szenen, hell/dunkel), `pnpm t1:screenshots`;
    Werbeseite `apps/aba-t1/site/` (statisch, ohne JS und fremde Server), Site-Test für beide Apps.
- Messwerte: Start bis zur Eingabezeile im Web-Build ≈ 200–280 ms (Chromium), ≈ 390 ms (WebKit), headless lokal;
  MicroPython-Start im Worker ≈ 20 ms nach dem Laden; Desktop-Debug-Build `ABA-T1.app` 33,6 MB.
- Nicht geprüft: die Desktop-App per Automation (Zugriff in dieser Sitzung nicht erteilt) – Build und Start sind lokal
  erfolgt, Bedienung und natives Menü bitte einmal von Hand prüfen; Windows/Linux-Builds nur über CI nach Freigabe.
- **Offen (Freigabe Marc):** Tag `aba-t1-v0.1.0` + Release, Web-Deployment und Upload der Produktseite, Signierung.

## Fortschritt

- [x] Lazy Loading, Budgets, Messwerte · [x] axe-Runde hell/dunkel, Befunde behoben · [x] Screenshots + README-Abschnitt
- [x] Werbeseite + Test · [x] CHANGELOG, Release-Trockenlauf (Notes, Version, Debug-Build macOS)
- [x] E2E Chromium + WebKit grün · [ ] Desktop-Bedienung von Hand (Marc) · [ ] Veröffentlichung (Marc)

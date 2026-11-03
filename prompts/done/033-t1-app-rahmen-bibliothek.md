# Prompt 033: ABA-T1 – App-Rahmen und App-Bibliothek

> **Abhängigkeiten:** 026, 027 · **Aufwand:** M · **Betrifft:** Frontend, Persistenz
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-app-rahmen`. Design-Dokument: `prompts/033-t1-app-rahmen-bibliothek.design.md`.

## 1. Ziel

Das **App-Konzept** des Vorbilds als Rahmen, in den 034–042 nur noch ihre Inhalte stecken:

- **App-Bibliothek** (Taste Apps): Raster aus App-Kacheln (eigene Icons), Touch/Wippe/Enter startet, Menüleiste
  **Speichern** (Kopie unter neuem Namen), **Zurücksetzen**, **Sortieren** (alphabetisch/chronologisch),
  **Löschen** (nur Kopien), **Start**.
- **Ansichten je App:** Symbolisch (Symb), Grafisch (Plot), Numerisch (Num) und jeweils **Einstellungen**
  (Shift+Symb/Plot/Num); **View-Menü** (Taste View) mit app-eigenen Zusatzansichten (z. B. geteilter Bildschirm,
  Zoom-Voreinstellungen); **Info** (Shift+Apps) = Notiz zur App (Text, später 045).
- **App-Zustand** (Definitionen, Fenster, Einstellungen, App-Variablen) bleibt pro App erhalten und wird beim
  Wiederöffnen hergestellt; App-Variablen sind in der Startansicht nutzbar (z. B. `Xmin`, `F1(2)`).

## 2. Architektur und Bezug

- Vorbild Kap. 6 (Einführung in HP Apps): Bibliothek, Zurücksetzen/Löschen, Ansichten und deren
  Einstellungen, systemweite Einstellungen, App-Notizen.
- Aktionssystem (026): jede App liefert Kontexte und Menüleisten je Ansicht.
- Persistenz über `StorageApi`, versionierte Dokumente je App (Migrationen ab Version 1 vorsehen).

## 3. Umsetzung

1. **Vertrag `T1App`** (Schnittstelle): `id`, `title`, `icon`, `views: { symb, plot, num, symbSetup, plotSetup,
numSetup, extra[] }`, `state` (serialisierbar, Schema-Version), `variables`, `reset()`, `help`.
2. **App-Registry** (eingebaute Apps; Kopien als Instanzen mit eigenem Namen und Zustand).
3. **Bibliothek** als Ansicht; **aktuelle App** global (Titelzeile zeigt App/Ansicht).
4. **Gemeinsame Bausteine:** Plot-Fläche (Viewport, Achsen, Raster, Zoom/Pan per Geste und Taste, Tracing-Cursor)
   und Wertetabelle (Num) als wiederverwendbare Komponenten – aus ABA-X1-Graph (`@aba/math/graph`, Graph-View)
   nach `packages/core` herauslösen, wo sinnvoll (024-Design §8).
5. **Demo-App** (minimal, z. B. „Leere App“) beweist den Rahmen; die echten Apps folgen ab 034.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Was von ABA-X1-Graph wird geteilt (Viewport, Sampler, Zeichnen, Interaktion) – ohne ABA-X1-Verhalten zu ändern?
- Plot-Rendering: Canvas (Empfehlung: Performance bei vielen Kurven) mit zugänglichem Textersatz.
- Lazy Loading je App (Bundle-Budget!).

## 4. Erwartete Dateien und Schnittstellen

- `apps/aba-t1/src/app/apps/{app-contract.ts,app-registry.ts,library-view.ts}`
- `packages/core/src/graph/*` (geteilte Plot-Fläche), `packages/core/src/grid/*` (Tabelle) – falls entschieden

## 5. Tests und Abnahmekriterien

**Tests**

- App-Zustand: speichern/laden/zurücksetzen/kopieren, Schema-Migration; App-Variablen in der Startansicht.
- Plot-Fläche: Viewport-Mathematik und Gesten (rein).

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Bibliothek öffnen, Demo-App starten, zwischen Symb/Plot/Num wechseln (Tasten und Kürzel), Kopie speichern,
  zurücksetzen, sortieren; Zustand nach Neustart.
- ABA-X1-Graph unverändert (E2E und Screenshots).

## 6. Ausdrücklich nicht Teil dieses Prompts

- Inhalte der einzelnen Apps (034 ff.), eigene Programm-Apps (044).

## 7. Doku

- `docs/architecture.md` (App-Vertrag), ADR falls Graph-Code nach core wandert, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- App-Vertrag in Kurzform; Bundle-Größen je App

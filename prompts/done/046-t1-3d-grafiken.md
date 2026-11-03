# Prompt 046: ABA-T1 – 3D-Grafiken (optional)

> **Abhängigkeiten:** 034 · **Aufwand:** M · **Betrifft:** Kern (Flächen-Sampling), Frontend (WebGL)
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-3d`. Design-Dokument: `prompts/046-t1-3d-grafiken.design.md`.

## 1. Ziel

App „3D-Grafiken“: Flächen `FZ1(X,Y)…FZ0(X,Y)` mit Symb (Definition, Farbe, Häkchen), Plot (drehen per Ziehen/
Wippe, zoomen per Pinch/Tasten, Box/Achsen/Gitter ein/aus, Höhenfarben), Num (Tabelle über X und Y),
Plot-Setup (X/Y/Z-Bereiche, Gitterdichte). Polstellen und undefinierte Bereiche erzeugen Lücken, keine Spitzen.

## 2. Architektur und Bezug

- Neuere Firmware des Vorbilds hat eine 3D-Grafiken-App (Handbuch: „Einführung in die 3D-Grafiken-App“).
- Kern: Gitter-Sampling mit Undefiniert-Masken im Worker; Frontend: WebGL2 (oder Canvas-2D-Fallback mit
  Painter-Algorithmus) – entscheiden. Plot-Rahmen aus 033.

## 3. Umsetzung

1. Kern `sampleSurface` (Gitter, Masken, Z-Clipping) + Specs.
2. Renderer (Rotation, Projektion, Tiefenpuffer), zugänglicher Textersatz (Beschreibung, Num-Ansicht).
3. App auf dem Rahmen, Gesten/Tasten.

### Entscheidungsfragen (im Design-Dokument beantworten)

- WebGL2 ohne Bibliothek vs. kleine Bibliothek (Größe, Lizenz); Verhalten ohne WebGL (WebView-Unterschiede!).

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/graph/surface.ts`, `apps/aba-t1/src/app/apps/graph3d/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Sampling von `X²+Y²`, `sin(X)·cos(Y)`, `1/(X·Y)` (Masken), Projektionsmathematik rein.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Fläche drehen/zoomen flüssig (Messung) in Chromium, WebKit und der Desktop-App (WKWebView/WebView2/WebKitGTK).

## 6. Ausdrücklich nicht Teil dieses Prompts

- 3D-Geometrie, Parameterflächen (später).

## 7. Doku

- Hilfe, `docs/architecture.md` (Renderer), `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- WebGL-Verfügbarkeit je Plattform

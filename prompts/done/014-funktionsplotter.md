# Prompt 014: Funktionsplotter (Graph-Modus)

> **Abhängigkeiten:** 005, 008, 013 · **Aufwand:** L · **Betrifft:** Frontend + Kern (Sampling)
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/funktionsplotter`. Design-Dokument: `prompts/014-funktionsplotter.design.md`.

## 1. Ziel

Der Graph-Modus (F3) zeigt mehrere Funktionen im Display (oder in einer vergrößerten Ansicht): Achsen, adaptives Raster, Zoom/Pan per Maus, Trackpad, Touch und Tastatur, Cursor mit Koordinaten, Unstetigkeiten nicht verbinden.

## 2. Architektur und Bezug

- Master-Prompt §3.7; Analyse im Kern (`src/math/graph/`), Darstellung im Frontend
- ADR 0006: Display hat feste Größe – Entscheidung, ob der Plot im LCD-Stil oder in einer größeren Fläche erscheint

## 3. Umsetzung

1. Adaptives Sampling mit Erkennung von Sprüngen/Asymptoten im Kern (Worker).
2. Canvas oder SVG (entscheiden, messen) im LCD-Stil.
3. Funktionsliste (Y=), Fenster (Xmin/Xmax/Auto), Softmenü ZOOM/TRACE/…
4. Export als PNG/SVG über `FilesApi` (002).

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Canvas oder SVG?** Messung bei 5 Funktionen und Zoom.
- **Plotgröße:** nur LCD oder zusätzlich großes Fenster am Desktop?

## 4. Erwartete Dateien und Schnittstellen

- `src/math/graph/sampler.ts`
- `features/graph/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Sampler: tan(x), 1/x, sqrt(x) am Rand, floor(x)
- Viewport-Mathematik rein getestet

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- tan(x) ohne senkrechte Verbindungslinien
- Zoom/Pan flüssig per Maus und Tastatur, App und Web

## 6. Ausdrücklich nicht Teil dieses Prompts

- Analysepunkte (015), Flächen (016)

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

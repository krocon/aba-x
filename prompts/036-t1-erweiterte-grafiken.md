# Prompt 036: ABA-T1 – Erweiterte Grafiken (Relationen und Ungleichungen)

> **Abhängigkeiten:** 034 · **Aufwand:** L · **Betrifft:** Kern (implizites Plotten), Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-erweiterte-grafiken`. Design-Dokument: `prompts/036-t1-erweiterte-grafiken.design.md`.

## 1. Ziel

Die App „Erweiterte Grafiken“ zeichnet **offene Sätze** in X und Y: implizite Gleichungen (`X²+Y²=4`,
`sin(X·Y)=0.5`), Ungleichungen mit Flächen (`Y>X²`, `X²+Y²<9 AND Y>0`), senkrechte Geraden (`X=2`), logische
Verknüpfungen (AND, OR, NOT, XOR). Plot mit Trace entlang von Rändern (Ränder/Schnittpunkte/Extremstellen der
Ränder anfahren), Num-Ansicht mit Rand-Tabelle (Werte, die die Relation erfüllen), **Grafikgalerie** mit
Beispielen (eigene Beispiele, keine Bilder des Vorbilds).

## 2. Architektur und Bezug

- Vorbild Kap. 8 (Erweiterte Grafiken): Definieren, Plotten, Trace „Rand“, Num-Ansicht, Galerie.
- Kern: implizites Plotten braucht **verlässliche** Verfahren – Intervallarithmetik (garantierte
  Einschluss/Ausschluss-Entscheidung je Zelle) mit adaptiver Unterteilung, Marching Squares für Ränder.
  Keine falschen Flächen: unsichere Zellen sichtbar anders darstellen oder weiter verfeinern.

## 3. Umsetzung

1. **Intervallarithmetik** im Kern (`interval.ts`): alle Katalogfunktionen mit korrekter Rundung nach außen
   (oder konservativer Erweiterung), Behandlung von Polstellen/undefinierten Bereichen.
2. **Adaptiver Quadtree** über dem Viewport im Worker; Ergebnis: Flächenkacheln (wahr/falsch/unsicher) und
   Randpolylinien; inkrementelles Nachverfeinern beim Zoom.
3. **App** mit Symb (V1…V0, Relationsoperatoren über eine Relations-Palette), Plot, Num, Setups.
4. Trace auf Rändern; Galerie als eigene View-Ansicht.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Rundung nach außen in JS (kein Rundungsmodus) – Next-Float-Erweiterung (`Math.nextafter` nachbauen) vs.
  Epsilon; Kosten messen.
- Auflösung/Zeitbudget je Bild, Anzeige „wird verfeinert“.

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/interval/*`, `packages/math/src/graph/implicit.ts` + Specs
- `apps/aba-t1/src/app/apps/advanced-graphing/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Intervallarithmetik: Einschluss-Property (für Zufallspunkte im Intervall liegt f(x) im Ergebnis-Intervall).
- Kreis, Hyperbel, `Y>X²`, `sin(X)·sin(Y)>0`, `X=2`; Relation ohne Lösung → leeres Bild statt Artefakte.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Beispiele aus der Galerie flüssig zoomen (Messung), Trace auf einem Kreisrand, Ungleichung schattiert.

## 6. Ausdrücklich nicht Teil dieses Prompts

- 3D (046), Geometrie (042).

## 7. Doku

- `docs/mathematics/implicit-plotting.md` (Verfahren, Garantien), Hilfe, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Performance-Messwerte; Review-Schwerpunkt Intervallarithmetik (separater Agent)

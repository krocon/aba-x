# Prompt 042: ABA-T1 – Geometrie-App (dynamische Geometrie)

> **Abhängigkeiten:** 033, 034 · **Aufwand:** XL (im Design in 042a/042b teilen) · **Betrifft:** Kern, Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-geometrie`. Design-Dokument: `prompts/042-t1-geometrie.design.md`.

## 1. Ziel

Dynamische Geometrie, bei der Plot (Zeichnung) und Symb (Definitionen GA, GB, …) dieselben Objekte zeigen:

- **Konstruieren** (Plot-Menü „Zeichnen“): Punkt, Punkt auf Objekt, Mittelpunkt, Schnittpunkte; Strecke, Strahl,
  Gerade, Parallele, Senkrechte, Tangente, Mittelsenkrechte, Winkelhalbierende, Höhe, Seitenhalbierende; Dreieck
  (gleichschenklig, rechtwinklig, gleichseitig), Viereck, Parallelogramm, Raute, Rechteck, Quadrat, regelmäßiges
  Polygon; Kreis, Um-/In-/Ankreis, Ellipse, Hyperbel, Parabel, Kegelschnitt, Ortslinie; Funktion/Parametrisch/
  Polar/Implizit (aus den Apps), Schieberegler.
- **Transformieren:** Verschiebung, Drehung, Spiegelung, Streckung, Ähnlichkeit, Projektion, Inversion.
- **Messen/Testen** (Num): Koordinaten, Abstand, Radius, Umfang, Steigung, Fläche, Winkel, Bogenlänge,
  Gleichung von; Tests (kollinear, auf Kreis, parallel, senkrecht, gleichseitig …) – **exakt**, wenn möglich
  (über CAS), sonst numerisch gekennzeichnet.
- Ziehen eines freien Punkts aktualisiert alles (Touch/Wippe), Objekte auswählen/verstecken/löschen/färben,
  Spur (Trace) von Punkten.

## 2. Architektur und Bezug

- Vorbild Kap. 10 (Geometrie). Plot-Fläche aus 033; implizite Kurven aus 036 (falls vorhanden).
- Kern `@aba/math/geometry`: Objektmodell als **Abhängigkeitsgraph** (freie Objekte, abgeleitete Objekte,
  Konstruktionsbefehle), Neuberechnung bei Änderung, degenerierte Fälle (parallele Geraden schneiden → „kein
  Schnittpunkt“, nie ein erfundener Punkt), Stetigkeit bei mehrdeutigen Schnittpunkten (Kreis ∩ Gerade).

## 3. Umsetzung

1. **042a – Kern + Grundobjekte:** Punkte, Geraden, Kreise, Polygone, Schnittpunkte, Messen; Symb-Liste mit
   Befehlssyntax (`point(1,2)`, `line(GA,GB)` …); Ziehen.
2. **042b – Erweiterungen:** Kegelschnitte, Transformationen, Ortslinien, Schieberegler, Tests, exakte Messungen
   über das CAS, Spur.
3. Befehle auch in der CAS-Ansicht nutzbar (wie im Vorbild), soweit die Engine das trägt.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Aufteilung 042a/042b und Mindestumfang.
- Mehrdeutige Schnittpunkte stabil halten (Zuordnung über Nähe zum letzten Zustand).
- Exaktheit: symbolische Koordinaten über das CAS vs. rationale Arithmetik vs. double mit Kennzeichnung.

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/geometry/{model.ts,constructions.ts,measure.ts,transform.ts}` + Cases
- `apps/aba-t1/src/app/apps/geometry/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Konstruktionen gegen analytisch bekannte Ergebnisse (Umkreismittelpunkt, Schwerpunkt, Tangenten an Kreis),
  Degenerationen, Abhängigkeitsgraph (Löschen kaskadiert oder wird abgelehnt), Zieh-Stabilität.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Dreieck konstruieren, Umkreis, Winkel messen, Eckpunkt ziehen → alles folgt; Tangente an eine Funktion mit
  Steigung; Touch und Tastatur.

## 6. Ausdrücklich nicht Teil dieses Prompts

- 3D-Geometrie; Import fremder Geometrieformate.

## 7. Doku

- `docs/mathematics/geometry.md`, Hilfe, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- umgesetzte/fehlende Befehle (Tabelle), Review-Schwerpunkte (Degenerationen)

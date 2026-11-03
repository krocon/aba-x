# Design 042 – ABA-T1: Geometrie-App (dynamische Geometrie)

- Status: umgesetzt (042a vollständig, 042b weitgehend) · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen:
  - **E1 Aufteilung:** 042a = Kern (`@aba/math/geometry`: Modell, Befehle, Messen, Render-Daten) + App mit Plot/Symb/Num,
    Ziehen, Grundobjekten; 042b = Kegelschnitte, Abbildungen, Ortslinie, Schieberegler, Tests, Spur – alles im Kern und
    in der App vorhanden. Offen bleiben exakte Messungen über das CAS, Funktionsgraphen als Geometrie-Objekte und die
    Befehle in der CAS-Ansicht (siehe „Nicht umgesetzt“).
  - **E2 Zustand = Skript:** Der App-Zustand (JSON) ist das Konstruktionsskript (`name = befehl(args)` je Zeile, aus
    `Construction.script()`) plus Anzeige: verborgene Objekte, Farben, Spur-Punkte, Messungen, Fenster, gleiche Achsen,
    Gitter. Kopieren/Export/Import der App funktionieren damit ohne eigenen Code.
  - **E3 Lebende Konstruktion:** `GeometrySession` (Service) hält die aus dem Skript gebaute `Construction` und baut nur
    neu, wenn sich das Skript anderswo geändert hat (andere Instanz, Symb-Bearbeitung, Zurücksetzen, Import). Beim
    Ziehen wird `movePoint` auf der lebenden Konstruktion aufgerufen und nur das neue Skript gespeichert – so bleibt die
    Zweigwahl mehrdeutiger Schnittpunkte (Nähe zur letzten Lage, im Kern) erhalten.
  - **E4 Mehrdeutige Schnittpunkte:** Beim Konstruieren per Tipp wird der Index (`intersect(…, i)`, `tangent(…, i)`)
    gewählt, dessen Lösung dem Tipp am nächsten liegt; beim Ziehen hält der Kern den Zweig über die Nähe zum
    vorherigen Wert. Nach einem Neuladen gilt wieder der gespeicherte Index (kanonische Reihenfolge) – dokumentierte
    Grenze.
  - **E5 Exaktheit:** double mit Kennzeichnung („Alle Werte sind numerisch“, Toleranz 10⁻⁹ × Szenengröße für Tests).
    Exakte Koordinaten über das CAS wären nur für Konstruktionen ohne Ziehen sinnvoll und bleiben offen.
  - **E6 Bedienung Plot:** Menütasten = Ansicht, Linien, Vieleck, Kreise, Abbild., Messen (Listen über `PlotMenu`). Ein
    Werkzeug sammelt seine Objekte Tipp für Tipp; eine freie Stelle erzeugt dort, wo ein Punkt verlangt ist, einen
    freien Punkt (auf ein Pixelraster von ≈ 2 px gerundet, damit das Skript lesbar bleibt). Zahlen (Radius, n, Winkel
    im Winkelmodus, Faktor, Schieberegler) fragt eine Eingabezeile ab. Ohne Werkzeug: Tipp wählt aus, dann wird das Menü
    zu Spur / Farbe / Verbergen / Löschen / Messen / OK; Ziehen eines freien Punkts bewegt ihn, sonst verschiebt es die
    Ebene; Pinch/Doppeltipp/+/− zoomen. Tastatur: Enter zeigt ein Kreuz, Wippe bewegt es (⇧ fein), Enter tippt dort;
    ein ausgewählter freier Punkt wird mit der Wippe bewegt, ein Schieberegler mit ←→.
  - **E7 Gleiche Achsen:** Standard ist ein Fenster mit gleichen Einheiten (y-Bereich aus dem x-Bereich und dem
    Seitenverhältnis), damit Kreise rund bleiben; im Plot-Setup abschaltbar.
  - **E8 Messen:** Num führt Messausdrücke (`distance(GA, GB)`, `angle(A, B, C)`, `area(t)`, `isCollinear(…)` …); Tests
    heißen `is…`, damit sie nicht mit den Konstruktionsbefehlen `parallel`, `perpendicular`, `equilateral` verwechselt
    werden. Die letzten vier Messungen stehen auch live über der Zeichnung und folgen beim Ziehen.

## Umgesetzte Befehle

| Bereich | Werkzeug (Plot) / Befehl (Symb) |
|---|---|
| Punkte | Punkt, Punkt auf Objekt (`pointOn`), Mittelpunkt, Schnittpunkt (Geraden/Strahlen/Strecken, Kreise, Kegelschnitte) |
| Linien | Strecke, Strahl, Gerade, Parallele, Senkrechte, Mittelsenkrechte, Winkelhalbierende, Tangente an Kreis, Höhe, Seitenhalbierende |
| Vielecke | Dreieck, Vieleck, gleichseitiges Dreieck, Quadrat, Parallelogramm, regelmäßiges Vieleck |
| Kurven | Kreis (Mitte+Punkt, Mitte+Radius, 3 Punkte), Um-, In-, Ankreis, Ellipse, Hyperbel, Parabel, Kegelschnitt durch 5 Punkte, Ortslinie, Schieberegler |
| Abbildungen | Verschiebung, Drehung, Spiegelung (Gerade/Punkt), Streckung, Projektion, Inversion; `similarity` per Befehl |
| Messen | Koordinaten, Abstand, Länge/Umfang, Fläche, Steigung, Winkel (3 Punkte / 2 Geraden), Radius, Gleichung, Bogenlänge |
| Tests | kollinear, konzyklisch, parallel, senkrecht, gleichseitig, gleichschenklig, Punkt auf Objekt |
| Objekte | auswählen, verbergen, löschen (kaskadierend), umbenennen, umdefinieren, färben, Spur von Punkten, PNG-Export |

## Nicht umgesetzt (bewusst offen)

- Rechtwinkliges/gleichschenkliges Dreieck, Raute, Rechteck als eigene Werkzeuge (per Befehl über Senkrechte,
  Kreis und Schnittpunkte konstruierbar).
- Funktion/Parametrisch/Polar/Implizit als Geometrie-Objekte und damit die **Tangente an eine Funktion mit Steigung**
  aus der Abnahme – das Modell kennt keine Funktionsgraphen; die Tangente samt Steigung bietet die Funktionen-App (Fcn).
- Exakte Messungen über das CAS (E5), Geometrie-Befehle in der CAS-Ansicht.
- Zweigwahl nach Neuladen (E4), Rückgängig.

## Review-Schwerpunkte (Degenerationen)

- Parallele Geraden schneiden, kollineare Umkreise, Tangente aus dem Kreisinneren → Objekt „undefiniert“ mit Grund
  (Symb rot, Num-Fehlertext), nie ein erfundener Punkt; abhängige Objekte werden wieder definiert, sobald die Lage es
  zulässt.
- Löschen kaskadiert (Meldung mit allen gelöschten Namen); Messungen, Spur, Farben verlieren die Verweise.
- Umdefinieren in Symb spielt das Skript neu ab; Verweise auf später definierte Objekte werden abgelehnt.

## Fortschritt

- [x] Kern (Merge aus `worktree-agent-a5f2e77ccd2f0db1e`) · [x] App: Plot (Werkzeuge, Ziehen, Spur, Zoom, PNG), Symb,
  Num, Plot-Setup, Hilfe DE/EN
- [x] Unit-Specs (`geometry-logic.spec.ts` 12, `geometry-session.spec.ts` 4) · [x] E2E `geometry` (Dreieck per Befehl,
  Fläche/Winkel/Radius, Eckpunkt ziehen → Fläche folgt, Mittelpunkt-Werkzeug per Tipp, axe auf allen drei Ansichten)

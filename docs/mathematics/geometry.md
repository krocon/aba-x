# Dynamische Geometrie (`@aba/math/geometry`, Prompt 042)

## Modell

- Eine **Konstruktion** (`model.ts`, Klasse `Construction`) ist ein Abhängigkeitsgraph benannter Objekte (GA, GB, …
  oder eigene Namen). Jedes Objekt hat einen Befehl (`commands.ts`, Tabelle `COMMANDS`), Argumente (Verweis auf ein
  älteres Objekt oder Zahl), statische Ergebnisarten und einen aktuellen Wert (`Shape` aus `shapes.ts`).
- **Freie Objekte:** `point(x, y)` mit Zahlen, `pointOn(objekt, t)` (Parameter t), `slider(wert, min, max)`. Nur sie
  lassen sich ziehen bzw. setzen (`movePoint`, `setParameter`, `setSlider`).
- **Textform:** `[name =] befehl(arg, …)`; ein Argument ist ein Objektname oder ein konstanter Ausdruck (`pi/3`,
  `sqrt(2)`). `script()` gibt die ganze Konstruktion zeilenweise zurück und lässt sich mit `run` bitgenau wieder
  abspielen. Die ABA-T1-App speichert genau dieses Skript als Zustand.
- **Undefiniert statt erfunden:** Degenerierte Lagen (parallele Geraden schneiden, kollineare Punkte umkreisen,
  Tangente von innen, zusammenfallende Brennpunkte …) ergeben `{ kind: 'undefined', reason }`; abhängige Objekte werden
  ebenfalls undefiniert und kehren zurück, sobald die Lage es zulässt.

## Neuberechnung

- Ein Objekt kann nur ältere Objekte verwenden, Definitionen ändern sich nach dem Anlegen nicht – die Erzeugungs-
  reihenfolge (aufsteigende Id) ist deshalb eine topologische Ordnung. Nach einer Änderung werden das Objekt und alle
  Nachfahren in dieser Reihenfolge neu berechnet (ein Durchlauf).
- **Löschen kaskadiert:** ein Objekt und alle Nachfahren verschwinden; die App meldet die Namen.
- **Umdefinieren** (Symb) baut die Konstruktion aus dem geänderten Skript neu; Verweise auf später definierte Objekte
  werden abgelehnt.
- **Ortslinie:** Für `locus(P, Q)` wird nur die Kette zwischen dem Punkt Q auf seinem Objekt und P für 240 Stellen des
  Parameters neu berechnet (Überlagerung, die übrige Szene bleibt fest).

## Zweigstabilität

- Mehrdeutige Schnitte (Gerade ∩ Kreis, Kreis ∩ Kreis, Gerade ∩ Kegelschnitt) liefern Kandidaten in kanonischer
  Reihenfolge (entlang der Geradenrichtung; bei zwei Kreisen zuerst links von M₁ → M₂). Hat das Objekt einen vorherigen
  Wert, wird der **nächstgelegene** Kandidat genommen – beim Ziehen bleibt der Punkt auf seinem Zweig. Ohne vorherigen
  Wert (neu oder zuvor undefiniert) entscheidet der Index.
- Die App wählt beim Antippen den Index der Lösung, die dem Tipp am nächsten liegt, und hält die Konstruktion während
  des Ziehens lebendig (`GeometrySession`), damit die vorherigen Werte erhalten bleiben. Nach einem Neuladen gilt
  wieder der gespeicherte Index.

## Toleranzen

| Größe | Wert |
|---|---|
| Szenengröße `scale` | größter Koordinatenbetrag aller charakteristischen Punkte (mindestens 1) |
| Längen-Toleranz (Entartung, Tests) | 10⁻⁹ × scale |
| Richtungen (parallel, senkrecht) | relativ 10⁻⁹ |
| Diskriminante der Schnitte | relativ 10⁻¹⁰ (Berührung = ein Doppelpunkt, dient beiden Indizes) |
| Kegelschnitt-Koeffizienten | relativ 10⁻¹⁰ gelten als 0 (Klassifikation) |

Alle Werte sind double; Messungen und Tests (`measure.ts`) sind numerisch und werden in der App so gekennzeichnet.
Exakte Messungen über das CAS sind nicht umgesetzt.

## Darstellung

`renderScene(construction, viewport)` liefert Primitive in Weltkoordinaten: Punkte, Strecken, Strahlen und Geraden
(Punkt + Einheitsrichtung, die Oberfläche schneidet zu), Kreise, Ellipsen (Halbachsen + Winkel), Vielecke und
Polylinien (Hyperbel- und Parabeläste werden für das sichtbare Fenster abgetastet, Ortslinien und invertierte Figuren
sind Polylinien).

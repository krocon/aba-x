# Prompt 027: ABA-T1 – Startansicht (Home), Eingabe und Einstellungen

> **Abhängigkeiten:** 026 · **Aufwand:** L · **Betrifft:** Kern (Auswertung, Zahlenformat), Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-startansicht`. Design-Dokument: `prompts/027-t1-startansicht.design.md`.

## 1. Ziel

Die **Startansicht** rechnet: Verlauf aus Eingabe/Ergebnis-Paaren (Eingabe links, Ergebnis rechts, neueste unten),
Eingabezeile im **Textbuch-** oder **Algebraisch**-Modus, Enter wertet numerisch aus, `Ans` und Wiederverwenden per
Wippe/Touch (Eintrag wählen → „Kopie“ in die Eingabe), Vorlagen-Taste (Bruch, Potenz, Wurzel, n-te Wurzel, Summe,
Ableitung, Integral, Betrag, Matrix, Liste, Stückweise …), Variablen A–Z (Sto▶, Zuweisung `A:=5`), Shift+Home =
**Einstellungen** der Startansicht.

## 2. Architektur und Bezug

- Kern: `@aba/math` Parser/Auswertung/`pretty` (ABA-X1 005/006/008) – wiederverwenden, nichts kopieren.
- MathLive für die Textbuch-Eingabe (nur `latex` weiterverarbeiten, Fonts aus dem Bundle); Algebraisch = einzeilige
  Texteingabe mit derselben Grammatik.
- Startansicht rechnet **numerisch** (reelle/komplexe Gleitkomma-Arithmetik), CAS ist eine eigene Ansicht (029).
  Ergebnisse sind trotzdem nur, was der Kern wirklich liefert (`MathResult`).
- Einstellungen des Vorbilds (Startansicht-Einstellungen, Kap. 2): Winkelmaß (Grad/Bogenmaß, später Neugrad?),
  Zahlenformat (Standard/Fest/Wissenschaftlich/Technisch mit Stellen), Ganzzahlen (Basis, Wortbreite, Vorzeichen →
  031), Komplex (aus / a+bi / Polar), Eingabe (Textbuch/Algebraisch/RPN → 028), Dezimaltrennzeichen,
  Menüanzeige, Schriftgröße, Farbthema, Sprache.

## 3. Umsetzung

1. **Home-Store** (Signals): Verlauf, Eingabe, Ans, Auswahl im Verlauf; Persistenz über `StorageApi`.
2. **Auswertung im Worker** über `ComputeClient`; Abbruch mit On; Zeitlimit.
3. **Zahlenformat** im Kern (`format.ts`): rein, mit Rundungs-Specs (Fest 2/4/11, Wissenschaftlich, Technisch,
   große/kleine Zahlen, −0, ∞/NaN als Fehler).
4. **Komplexe Zahlen** in der Startansicht: Kern um komplexe Auswertung erweitern, falls nicht vorhanden
   (`i`, `abs`, `arg`, `conj`, Polarform) – sonst sichtbarer Fehler „komplexes Ergebnis“ je Einstellung.
5. **Vorlagen-Taste:** Palette (Touch-Raster, per Wippe navigierbar) fügt LaTeX-Vorlagen mit Platzhaltern ein.
6. **Verlauf bedienen:** Wippe hoch/runter wählt, Enter/„Kopie“ übernimmt, Touch-Tippen wählt, Wischen scrollt,
   Shift+Esc (Clear) leert mit Rückfrage; Menüleiste: `Sto▶`, `Kopie`, `Anzeigen` (Großansicht), `•`/Format.
7. **Einstellungen** als eigene Ansicht mit mehreren Seiten (Touch-Reiter), Felder mit Wippe/Enter bedienbar,
   „Schnelleinstellungen“ per Tippen auf die Titelzeile (Winkelmaß, Uhrzeit).

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Komplexe Zahlen:** eigener Typ im Kern (`Complex`) vs. Erweiterung des Auswerters – Folgen für ABA-X1.
- **Ganzzahl vs. Gleitkomma** in der Startansicht (z. B. `2^70` exakt?) – Vorbild rechnet mit Dezimalstellen
  (12 signifikante Stellen); Entscheidung und Grenzen dokumentieren.
- **Verlaufsgröße** und Persistenz (Anzahl Einträge, LaTeX + AST?).

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/numeric/{format.ts,complex.ts}` (+ `*.cases.json`)
- `apps/aba-t1/src/app/features/home/{home-store.ts,home-view.ts,history-list.ts,templates.ts}`
- `apps/aba-t1/src/app/features/settings/*`, `apps/aba-t1/src/app/core/i18n/texts.ts`

## 5. Tests und Abnahmekriterien

**Tests**

- Format: Tabelle Wert × Format × Stellen → Text; Rundungsgrenzen; Komplex in beiden Darstellungen.
- Auswertung: Referenzfälle (Master ABA-X1 §6.2) gelten auch hier; Fehlerfälle (Division durch 0, Bereich,
  undefiniert) zeigen Meldungen statt Zahlen.
- Store: Ans, Wiederverwenden, Variablen A–Z, Persistenz mit Fake-Storage.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- `2+3×4` → 14; `sin(30)` in Grad → 0.5; `√(−4)` mit Komplex an → `2·i`, aus → Fehlermeldung.
- Vorlage Bruch per Taste und per Touch, Eingabe mit Hardware-Tastatur; Verlaufseintrag kopieren.
- Einstellungen bleiben nach Neustart erhalten (App und Web).

## 6. Ausdrücklich nicht Teil dieses Prompts

- RPN (028), CAS (029), Toolbox-Menüs (030), Einheiten/Basen (031), Listen/Matrizen (032).

## 7. Doku

- `docs/roadmap.md` (ABA-T1 „Was funktioniert“), README-Abschnitt ABA-T1, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Grenzen der Zahlendarstellung; was für 028/029 vorbereitet ist

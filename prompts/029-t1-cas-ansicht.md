# Prompt 029: ABA-T1 – CAS-Ansicht und Entscheidung zur CAS-Engine

> **Abhängigkeiten:** 027 · **Aufwand:** L · **Betrifft:** Kern (SymbolicEngine), Frontend, ggf. Lizenz
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-cas`. Design-Dokument: `prompts/029-t1-cas-ansicht.design.md`.

## 1. Ziel

Die **CAS-Ansicht** (Taste CAS) hat einen eigenen Verlauf und rechnet **exakt/symbolisch**: Vereinfachen,
Erweitern, Faktorisieren, Lösen (reell/komplex/numerisch), Ableiten, Integrieren, Grenzwerte, Reihen/Taylor,
Summen, ggT/kgV, Primfaktoren, Polynomdivision. Eigene **CAS-Einstellungen** (Shift+CAS): Winkelmaß, exakt vs.
näherungsweise, Komplex, Hauptvariable, Vereinfachungsstufe, Anzahl Stellen. Startvariablen (A–Z) sind im CAS
nutzbar, CAS-Ergebnisse lassen sich in die Startansicht kopieren und umgekehrt.

## 2. Architektur und Bezug

- `SymbolicEngine` + Nerdamer-Adapter + `verify.ts` (ABA-X1 009–012, ADR 0004): jede Antwort wird gegengeprüft;
  Funktionen nur per Positivliste.
- CAS-Menü des Vorbilds (Kap. 23 „CAS-Menü“): Algebra (Vereinfachen, Erweitern, Faktorisieren, Substituieren,
  Teilbruchzerlegung, Extrahieren: Zähler/Nenner/linke/rechte Seite), Analysis (Differenzieren, Integrieren,
  Grenzwerte, Summen, Taylor, Transformationen), Lösen (Lösen, Nullstellen, komplex, numerisch, lineares System,
  DGL), Neu schreiben (exp/ln, trig), Ganzzahl (Faktoren, ggT, kgV, Primzahl, Euler, Rest, Chinesischer Rest),
  Polynom (Nullstellen, Koeffizienten, Divisoren, Grad, ggT, Spezielle Polynome), Plot.
- Das Menü selbst baut 030 (Toolbox); hier: Engine-Funktionen + Ansicht + Einstellungen.

## 3. Umsetzung

1. **Engine-Entscheidung 🛑** (siehe unten) – vor allem anderen, mit Prototyp und Messung.
2. **Lücken-Tabelle:** jede CAS-Menüfunktion des Vorbilds → unterstützt (Engine + Gegenprobe) / teilweise / nicht
   (ehrlich ablehnen, Menüeintrag ausgegraut mit Hinweis). Nichts vortäuschen.
3. **CAS-Ansicht** mit eigenem Verlauf, Textbuch-Eingabe, Menüleiste (`Vereinf.`, `Kopie`, `Anzeigen`, `≈`
   Näherung), Ergebnisse als Lehrbuchform (`pretty.ts`).
4. **Variablen:** CAS-Variablen (Kleinbuchstaben, `f(x):=…`) getrennt von Startvariablen; Startvariablen als
   Zahlen einsetzbar.
5. **Einstellungen** und Zeitlimit/Abbruch (On) im Worker.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **CAS-Engine:** (a) Nerdamer behalten und gezielt im Kern erweitern (Lizenz MIT bleibt, Umfang begrenzt),
  (b) **Giac** als WASM (giac.js) – Umfang nahe am Vorbild, aber **GPL-3** (die ausgelieferte App würde GPL;
  Entscheidung Marc), Bundle-Größe und Ladezeit messen, (c) anderes (SymPy via Pyodide: groß, langsam beim Start;
  Algebrite; math.js symbolisch). Empfehlung mit Messwerten (Bundle, Startzeit, Abdeckung der Lücken-Tabelle).
- Wird die Engine pro App gewählt (ABA-X1 bleibt Nerdamer) oder für beide gewechselt?
- Wie werden äquivalente, aber anders aussehende Ergebnisse normalisiert (Anzeige wie Vorbild nicht nötig)?

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/symbolic/*` (Erweiterungen, ggf. neuer Adapter hinter `SymbolicEngine`), `*.cases.json`
- `apps/aba-t1/src/app/features/cas/{cas-store.ts,cas-view.ts,cas-settings.ts}`
- ggf. ADR `0009-cas-engine-aba-t1.md`, `docs/mathematics/` (Lücken-Tabelle)

## 5. Tests und Abnahmekriterien

**Tests**

- Referenzfälle je Menübereich (≥ 5 pro Bereich), Prüfung über Einsetzen/Ableiten/Normalform.
- Ablehnungsfälle: nicht unterstützte Operation → klare Meldung, nie falsches Ergebnis.
- Property-Tests: `diff(int(f)) ≡ f` für Stichproben, `expand(factor(p)) ≡ p`.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- `factor(x^2−5x+6)` → (x−2)(x−3); `solve(x^2=2,x)` → ±√2; `∫₀¹ x² dx` → 1/3; `limit(sin(x)/x,x,0)` → 1.
- Ergebnis aus CAS in die Startansicht kopieren und dort numerisch auswerten.
- Abbruch einer langen Rechnung mit On; Ansicht bleibt bedienbar.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Toolbox-Menüstruktur (030), Plot aus dem CAS (034), Matrizen-CAS (032).

## 7. Doku

- `docs/mathematics/` (Abdeckung), ggf. ADR, `docs/architecture.md` (Abhängigkeit, Lizenz, Größe), `pnpm notices`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Lücken-Tabelle (unterstützt/teilweise/nicht) und Engine-Entscheidung mit Messwerten

# Prompt 030: ABA-T1 – Toolbox, Katalog, Zeichen und Hilfe

> **Abhängigkeiten:** 027, 029 · **Aufwand:** M · **Betrifft:** Frontend, Kern (Funktionskatalog)
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-toolbox`. Design-Dokument: `prompts/030-t1-toolbox-katalog-hilfe.design.md`.

## 1. Ziel

Die Toolbox-Taste öffnet die **Toolbox-Menüs** mit fünf Reitern in der Menüleiste: **Math** (Zahlen,
Arithmetik, Trigonometrie, Hyperbolisch, Wahrscheinlichkeit, Liste, Matrix, Sonderfunktionen …), **CAS** (Struktur
aus 029), **App** (Funktionen der Apps, wächst mit 033 ff.), **Nutzer** (eigene Funktionen/Programme, ab 043) und
**Katalog** (alle Befehle alphabetisch, Suche per Alpha-Buchstaben). Vars-Taste: Variablen (Start, CAS, App,
Nutzer). Shift+Vars: **Zeichenpalette**. Help-Taste: **kontextabhängige Hilfe** (zur Ansicht oder zum markierten
Befehl, mit Syntax und Beispiel, Einfügen).

## 2. Architektur und Bezug

- `packages/math/src/functions.ts` ist die einzige Quelle des Funktionskatalogs (auch CAS-Positivliste) – um
  Kategorien, Syntax-Vorlagen und Hilfe-Schlüssel erweitern, nicht duplizieren.
- Vorbild Kap. 2 „Toolbox-Menüs“, Kap. 23 „Menü Math“, Menüformat (Befehlsname vs. Beschreibung umschaltbar).
- Hilfetexte selbst schreiben (DE/EN), keine Handbuchtexte (Master-Prompt ABA-T1 §1).

## 3. Umsetzung

1. **Menümodell** (rein): Baum Kategorie → Untermenü → Befehl `{ id, label, template, help }`; Navigation per
   Wippe, Ziffern-Schnellwahl, Touch; Einfügen an der Cursorposition (Textbuch-Vorlage mit Platzhaltern).
2. **Katalog:** alphabetisch, Alpha-Buchstabe springt, Suche; zeigt nur, was der Kern wirklich kann (nicht
   unterstützte CAS-Befehle markiert).
3. **Vars-Menü** mit Gruppen und Wertvorschau; **Zeichenpalette** (griechisch, Mathematik, Pfeile …).
4. **Hilfe:** Index, Suche, Kontext (Ansicht/markierter Befehl), Beispiel einfügen; Hilfetexte als Daten
   (`help/*.md` oder JSON) mit Vollständigkeits-Spec (jeder Katalogbefehl hat Hilfe).
5. **Menüformat-Einstellung** (Befehlsname vs. Beschreibung) aus 027 anbinden.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Hilfeformat und Darstellung (Markdown mit Formeln über `<app-math>`?), Größe im Bundle, Lazy Loading.
- Gemeinsames Hilfe-Gerüst mit ABA-X1 (`features/help`) → `packages/core`?

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/functions.ts` (Kategorien, Vorlagen), Spec auf Vollständigkeit
- `apps/aba-t1/src/app/features/{toolbox,catalog,vars,chars,help}/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Jeder Menüeintrag verweist auf einen Katalogbefehl; jeder Befehl hat Hilfe in DE und EN; Vorlagen parsen.
- Navigation (Modell) mit Wippe/Ziffern rein getestet.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Toolbox → Math → Wahrscheinlichkeit → Fakultät fügt `!`-Vorlage ein; Katalog „Z“ springt; Hilfe zu `factor`
  zeigt Beispiel und fügt es ein.
- Alles per Hardware-Tastatur bedienbar, Screenreader liest Menüeinträge.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Einheiten-/Konstanten-Menü (031), App-Funktionen der einzelnen Apps (kommen mit den Apps).

## 7. Doku

- Hilfe-Konventionen in `docs/`, README (Toolbox), `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Liste der Menüeinträge des Vorbilds, die fehlen (mit Grund)

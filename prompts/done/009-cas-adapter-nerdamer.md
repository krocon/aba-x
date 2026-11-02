# Prompt 009: CAS-Adapter mit Nerdamer 2

> **Abhängigkeiten:** 003, 004 · **Aufwand:** L · **Betrifft:** Kern (Worker)
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/cas-adapter-nerdamer`. Design-Dokument: `prompts/009-cas-adapter-nerdamer.design.md`.

## 1. Ziel

`SymbolicEngine` hinter einem Adapter auf Nerdamer 2.0.1, im Worker, mit den Schutzmaßnahmen aus der Phase-0-Bewertung. Capability-Matrix als Doku und als Test.

## 2. Architektur und Bezug

- ADR 0004; **`docs/technical-evaluation.md` §3 (Fehlerfälle + Pflichten des Adapters) ist verbindlich**
- Prototyp `docs/spikes/cas-capabilities.cjs`
- Funktionskatalog aus 003 = Positivliste

## 3. Umsetzung

1. Interface `SymbolicEngine` (simplify, expand, factor, differentiate, integrate, solve, solveSystem, limit, substitute) – nur Fähigkeiten, die es wirklich gibt.
2. AST → Nerdamer-String (Positivliste, `ln→log` …), Ergebnis → AST (eigener Parser).
3. Unausgewertete Ergebnisse (`integrate(`, `limit(` …) → `unsupported`/`not-solvable`; Dezimalanteile → als numerisch markieren.
4. Bestimmte Integrale exakt als F(b)−F(a), sonst numerisch (013) mit Kennzeichnung.
5. Capability-Matrix (vollständig / teilweise / nicht / mit Einschränkungen) als Doku **und** als Spec-Katalog.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Bundle:** Nerdamer (159 kB gzip) nur im Worker-Chunk laden – prüfen.
- **Zweiter Adapter?** Compute Engine nur skizzieren, nicht bauen.

## 4. Erwartete Dateien und Schnittstellen

- `src/math/symbolic/{symbolic-engine,nerdamer-adapter,capabilities}.ts`
- `docs/mathematics/cas-capabilities.md`

## 5. Tests und Abnahmekriterien

**Tests**

- Referenzen Master-Prompt §6.2 per Äquivalenz (Einsetzen/Ableiten)
- Regression: `diff(ln(x)/x)` ≠ 0, `foo(x)` abgelehnt, `defint` exakt 1/3, `expand` funktioniert
- Property: d/dx ∫f = f (numerisch an Stützstellen)

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Kein einziger Fall der Bewertungstabelle liefert ein falsches Ergebnis
- Nerdamer lädt erst im CAS-Gebrauch, im Web-Build offline

## 6. Ausdrücklich nicht Teil dieses Prompts

- UI des CAS-Modus (010)

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen
- `docs/architecture.md` §6 (Nerdamer, Apache-2.0)
- `pnpm notices`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund
- Lücken von Nerdamer mit Beispiel

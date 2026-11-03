# Prompt 035: ABA-T1 – Parametrisch-, Polar- und Folge-App

> **Abhängigkeiten:** 034 · **Aufwand:** M · **Betrifft:** Kern (Sampler-Varianten, Folgen), Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-param-polar-folge`. Design-Dokument: `prompts/035-t1-parametrisch-polar-folge.design.md`.

## 1. Ziel

Drei Apps auf dem Rahmen von 033/034:

- **Parametrisch:** X1(T)/Y1(T) … X0(T)/Y0(T), T-Bereich und T-Schritt im Plot-Setup, Trace über T, Tabelle über T.
- **Polar:** R1(θ) … R0(θ), θ-Bereich/Schritt, Grad/Bogenmaß beachten, Trace, Tabelle über θ.
- **Folge:** U1(N) … U0(N), explizit oder rekursiv (`U1(N)=U1(N−1)+U1(N−2)`, Startglieder U1(1), U1(2)),
  Darstellung **Treppe** und **Spinnennetz** (Cobweb), Tabelle über N.

## 2. Architektur und Bezug

- Vorbild Kap. 17 (Parametrisch), 18 (Polar), 19 (Folge); Plot-Fläche/Tabelle aus 033, Analyse aus 034.
- Sampler im Kern um Parameter-Kurven (adaptive T-Verfeinerung, Sprünge) erweitern; Folgen als eigenes Modul
  (Rekursion mit Memo, Zyklen/Selbstbezug als Fehler).

## 3. Umsetzung

1. Kern: `sampleParametric`, `samplePolar` (→ Parametrisch), `sequence.ts` (explizit, rekursiv bis Ordnung 2,
   Grenzen, Fehlercodes).
2. Drei Apps mit Symb/Plot/Num + Setups, Trace-Varianten, App-Variablen (`Tmin`, `θstep`, `Nmin` …).
3. Spinnennetz-Darstellung (Folge) und Treppe; Zeichenreihenfolge animiert nur ohne `prefers-reduced-motion`.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Rekursionstiefe und Grenzen (z. B. N ≤ 10⁵); Speicherbedarf; Abbruch.

## 4. Erwartete Dateien und Schnittstellen

- `packages/math/src/graph/{parametric.ts,sequence.ts}` + Specs
- `apps/aba-t1/src/app/apps/{parametric,polar,sequence}/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Kreis (cos T, sin T) geschlossen; Rose r=cos(3θ); Fibonacci-Folge; Folge mit Selbstbezug → Fehler; Polstellen
  in Parameterkurven.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Je App ein Beispiel plotten, tracen, Tabelle ansehen; Spinnennetz für `U1(N)=2.8·U1(N−1)·(1−U1(N−1))`.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Implizite Kurven (036), 3D (046).

## 7. Doku

- Hilfe, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7

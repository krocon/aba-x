# Prompt 012: Symbolische Integration

> **Abhängigkeiten:** 009, 013 · **Aufwand:** M · **Betrifft:** Kern + Frontend
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/symbolische-integration`. Design-Dokument: `prompts/012-symbolische-integration.design.md`.

## 1. Ziel

Unbestimmte Integrale mit `+ C`, bestimmte Integrale exakt (F(b)−F(a)) oder numerisch mit Fehlerabschätzung, ehrliche Meldung bei nicht elementar lösbaren Integralen.

## 2. Architektur und Bezug

- Master-Prompt §3.6, Bewertung §3 (`defint` nur numerisch)

## 3. Umsetzung

1. ∫-Vorlage (⇧◀7) → Integralknoten mit/ohne Grenzen.
2. Bestimmte Integrale: Stammfunktion → Grenzen einsetzen; Unstetigkeiten im Intervall erkennen (sonst falsches Ergebnis!).
3. Fallback numerisch (013), Anzeige „≈ … (± Fehler)“.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Uneigentliche Integrale?** Grenzwerte über `limit` oder ablehnen?

## 4. Erwartete Dateien und Schnittstellen

- `src/math/symbolic/integrate.ts`

## 5. Tests und Abnahmekriterien

**Tests**

- ∫₀¹x² = 1/3 exakt, ∫x·eˣ, ∫e^(−x²) = erf
- ∫_{-1}^{1} 1/x → Fehler/Hinweis statt 0
- Property: d/dx F = f

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Ergebnisse wie oben in App und Web

## 6. Ausdrücklich nicht Teil dieses Prompts

- Flächen im Graph (016)

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

# Prompt 018: Einstellungen (SETUP) und Deutsch/Englisch

> **Abhängigkeiten:** 007 · **Aufwand:** M · **Betrifft:** Frontend + Persistenz
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/einstellungen-i18n`. Design-Dokument: `prompts/018-einstellungen-i18n.design.md`.

## 1. Ziel

SETUP-Menü/Dialog: Winkelmodus, exakt/numerisch, Genauigkeit, Zahlenformat, Theme der Seite, Sprache; Laufzeit-i18n Deutsch/Englisch wie FnF.

## 2. Architektur und Bezug

- Vorbild FnF `core/i18n/` (translatable, Kataloge je Feature), `core/settings/`

## 3. Umsetzung

1. Einstellungsschema mit Defaults und sanitize.
2. i18n-Kataloge je Feature, Vollständigkeitstest.
3. Annunciators (RAD/DEG, EXACT/APPROX) aus den Einstellungen.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Gerät auch übersetzen?** Tastenbeschriftungen bleiben englisch (wie Rechner), Meldungen übersetzt?

## 4. Erwartete Dateien und Schnittstellen

- `core/settings/*`, `core/i18n/*`

## 5. Tests und Abnahmekriterien

**Tests**

- Schema, sanitize, Katalog-Vollständigkeit

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Umschalten wirkt sofort und bleibt nach Neustart

## 6. Ausdrücklich nicht Teil dieses Prompts

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

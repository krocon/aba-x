# Prompt 023: README, Screenshots, Werbeseite

> **Abhängigkeiten:** 010, 014 · **Aufwand:** S · **Betrifft:** Doku
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/readme-screenshots-werbeseite`. Design-Dokument: `prompts/023-readme-screenshots-werbeseite.design.md`.

## 1. Ziel

README mit echten Screenshots (reproduzierbar per Skript, Desktop und Web), Funktionsübersicht, Downloads und Link zur Web-Version; optional eine statische Werbeseite wie FnF `site/`.

## 2. Architektur und Bezug

- Vorbild FnF Prompt 044, `scripts/screenshots/`, `site/`

## 3. Umsetzung

1. Playwright-Skript `pnpm screenshots` für definierte Szenen (Standard, CAS, Graph, hell/dunkel).
2. README-Abschnitte je Funktion mit Bild.

### Entscheidungsfragen (im Design-Dokument beantworten)

- keine

## 4. Erwartete Dateien und Schnittstellen

- `scripts/screenshots/*`
- `docs/screenshots/`

## 5. Tests und Abnahmekriterien

**Tests**

- Skript-Smoke-Test

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Screenshots entstehen reproduzierbar

## 6. Ausdrücklich nicht Teil dieses Prompts

- Veröffentlichung der Seite

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

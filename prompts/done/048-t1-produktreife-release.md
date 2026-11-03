# Prompt 048: ABA-T1 – Produktreife: Barrierefreiheit, i18n, PWA, Release, README, Werbeseite

> **Abhängigkeiten:** 025–045 (Pflicht- und umgesetzte Soll-Prompts) · **Aufwand:** M · **Betrifft:** alles,
> CI/Release, Doku
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-produktreife`. Design-Dokument: `prompts/048-t1-produktreife-release.design.md`.

## 1. Ziel

ABA-T1 ist veröffentlichungsbereit – entsprechend ABA-X1 020–023, aber für die zweite App:

- **Barrierefreiheit:** axe ohne Befund in allen Ansichten; Plot/Geometrie/Spreadsheet mit Textersatz und
  Tastaturbedienung; Live-Region für Ergebnisse; Fokusführung bei Ansichtswechsel; Kontraste des Geräts.
- **i18n:** DE/EN vollständig (Vollständigkeits-Spec), Hilfe in beiden Sprachen, natives Menü übersetzt
  (024-Nebenbefund 3 auch für ABA-X1 prüfen).
- **Performance:** Startzeit, Bundle-Budgets je App, Lazy Loading der Apps; Messwerte im Bericht.
- **PWA/Offline:** Service Worker, Manifest, Icons, Offline-E2E.
- **E2E:** `pnpm e2e --app aba-t1` (Chromium + WebKit) mit Kernszenarien je App, 375 px, hell/dunkel.
- **Release vorbereiten:** Version 0.1.0, Release-Notes, `release.yml` für `aba-t1-v*` trocken geprüft,
  Signierung wie ABA-X1 vorbereitet (`docs/macos-signing.md`) – **kein Tag, kein Push, kein Upload ohne Freigabe**.
- **README/Screenshots:** `docs/screenshots/aba-t1/` über `pnpm screenshots --app aba-t1`; README-Abschnitt.
- **Werbeseite:** `apps/aba-t1/site/` (statisch, kein JS, keine fremden Server, eigene Bilder), Test analog
  `scripts/site.test.mjs`; Vergleich zum Vorbild nur sachlich in Textform, ohne Fremdlogos.

## 2. Architektur und Bezug

- ABA-X1 020 (PWA), 021 (Barrierefreiheit), 022 (Release), 023 (README/Werbeseite); `docs/accessibility.md`,
  `docs/release.md`, `docs/deployment.md`, `docs/distribution.md`.

## 3. Umsetzung

1. Prüfliste je Bereich, Befunde beheben, Messwerte erheben.
2. Skripte (`e2e`, `screenshots`, `site`) für `aba-t1` erweitern; Szenen festlegen.
3. Doku vervollständigen, Release trocken prüfen.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Welche Kann-/Soll-Prompts sind für 0.1.0 Pflicht, welche folgen in 0.2?
- Web-Ziel und Produktseiten-Pfad endgültig (Entscheidung Marc).

## 4. Erwartete Dateien und Schnittstellen

- `scripts/e2e/*`, `scripts/screenshots/*` (Szenen ABA-T1), `apps/aba-t1/site/*`, `docs/*`, README, `CHANGELOG.md`

## 5. Tests und Abnahmekriterien

**Tests**

- E2E-Szenarien grün in Chromium und WebKit; Site-Test; i18n-Vollständigkeit; `pnpm check` für alle Apps.

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Debug-Builds macOS (lokal), Windows/Linux über CI (nur mit Freigabe gepusht); Web-Build offline; Screenshots
  und Werbeseite angesehen.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Veröffentlichung selbst (Tag, Release, Deployment) – nur nach ausdrücklicher Anweisung von Marc.

## 7. Doku

- README, `docs/roadmap.md`, `docs/release.md`, `CHANGELOG.md`, `apps/aba-t1/site/README.md`, `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Messwerte, offene Befunde, Freigaben, die Marc erteilen muss

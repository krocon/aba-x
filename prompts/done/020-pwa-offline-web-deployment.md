# Prompt 020: PWA, Offline-Test, Web-Deployment (vorbereitet)

> **Abhängigkeiten:** 005 · **Aufwand:** S · **Betrifft:** Web
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/pwa-offline-web-deployment`. Design-Dokument: `prompts/020-pwa-offline-web-deployment.design.md`.

## 1. Ziel

Die Webseite ist installierbar und nach dem ersten Laden vollständig offline nutzbar; Update-Hinweis bei neuer Version; Deployment-Workflow (GitHub Pages oder krocon.de) vorbereitet, aber **nicht** aktiviert.

## 2. Architektur und Bezug

- `ngsw-config.json`, `public/manifest.webmanifest`, `angular.json` (Konfiguration `web`, `baseHref`)
- Vorlage `docs/ci/pages.yml`

## 3. Umsetzung

1. Offline-E2E mit Playwright (Netz aus, Rechnen, CAS-Chunk, Fonts).
2. SwUpdate: Hinweis „neue Version – neu laden“.
3. Deployment-Varianten mit `base-href` dokumentieren; CSP-Header-Empfehlung.
4. Browser-Kompatibilität (Chromium, Firefox, Safari) prüfen und dokumentieren.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Ziel:** GitHub Pages unter `/aba-x/` oder `krocon.de/products/aba-x`? – Marc entscheidet.

## 4. Erwartete Dateien und Schnittstellen

- `scripts/e2e/*` (Playwright)
- `docs/deployment.md`

## 5. Tests und Abnahmekriterien

**Tests**

- Playwright: offline, Update

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- App im Flugmodus nach erstem Besuch voll nutzbar

## 6. Ausdrücklich nicht Teil dieses Prompts

- Deployment ausführen

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund
- gewähltes Ziel und offene Freigaben

# Design 020 – PWA, Offline, Web-Deployment

- Status: umgesetzt (Deployment vorbereitet, nicht ausgeführt) · Datum: 02.11.2026

## Entscheidungen
- E1 Service Worker lädt App, Rechen-Worker und Schriften vorab; Offline-E2E (Chromium): Netz aus, Neuladen,
  Ableitung rechnen.
- E2 Update-Hinweis über `SwUpdate` (`VERSION_READY`) in der Statuszeile mit „Neu laden“.
- E3 Ziel (GitHub Pages oder krocon.de) entscheidet Marc; Vorlage `docs/ci/pages.yml`, Anleitung und
  Header-Empfehlungen in `docs/deployment.md`.
- E4 Browser: Chromium und WebKit automatisiert (`pnpm e2e`), Firefox hier nicht startbar → CI.

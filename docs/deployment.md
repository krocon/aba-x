# Web-Deployment (vorbereitet, nicht aktiv)

> Prompt 020. **Es wird nichts veröffentlicht, bevor Marc das Ziel wählt und freigibt.**

## Build

```bash
pnpm build:web                         # → dist/web/browser (base-href /)
pnpm build:web --base-href /aba-x/     # z. B. für GitHub Pages unter /aba-x/
```

Der Ordner ist rein statisch (kein Server): `index.html`, Bundles, `ngsw-worker.js` + `ngsw.json` (Service Worker),
`manifest.webmanifest`, Icons, MathLive-Schriften.

## Ziele

| Ziel | Schritte |
|---|---|
| GitHub Pages | `docs/ci/pages.yml` nach `.github/workflows/` kopieren, `--base-href /aba-x/` prüfen, Pages in den Repo-Einstellungen auf „GitHub Actions“ stellen, Workflow manuell starten |
| krocon.de/products/aba-x | `pnpm build:web --base-href /products/aba-x/`, Inhalt von `dist/web/browser` hochladen; `index.html` als Fallback für unbekannte Pfade ist nicht nötig (keine Routen) |

## Server-Einstellungen

- `ngsw-worker.js` und `ngsw.json` **ohne** lange Cache-Dauer ausliefern (sonst kommen Updates spät an); gehashte
  Bundles dürfen lange gecacht werden.
- HTTPS ist Pflicht für den Service Worker (außer `localhost`).
- Empfohlene Header:
  `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self'; connect-src 'self'; manifest-src 'self'`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
  (`'unsafe-inline'` bei Styles brauchen Angular-Komponenten und MathLive.)

## Offline und Updates

- Nach dem ersten Besuch läuft alles offline: Service Worker lädt App, Rechen-Worker (Nerdamer) und Schriften vorab
  (geprüft mit `pnpm e2e`: Netz aus, Neuladen, Ableitung rechnen).
- Neue Version: der Service Worker lädt sie im Hintergrund, die Statuszeile zeigt „Eine neue Version ist verfügbar
  – Neu laden“.

## Browser-Unterstützung

| Browser | Status |
|---|---|
| Chromium (Chrome, Edge) | ✅ `pnpm e2e` (alle Prüfungen inkl. offline) |
| WebKit (Safari) | ✅ `pnpm e2e` (alle Prüfungen; Offline-Test nur in Chromium automatisiert) |
| Firefox | 🟡 nicht automatisiert geprüft – Playwright-Firefox startet in dieser macOS-Sandbox nicht; in der CI unter Linux nachholen |

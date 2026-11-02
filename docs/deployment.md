# Web-Deployment (vorbereitet, nicht aktiv)

> Prompt 020. **Ziel (Marc, 02.11.2026): https://krocon.de/products/aba-x1/** – hochgeladen wird erst nach Freigabe.

## Build

```bash
pnpm build:web       # → dist/web/browser, base-href /products/aba-x1/ (angular.json, Konfiguration „web“)
pnpm serve:web       # lokal genau so ansehen: http://localhost:4300/products/aba-x1/
```

Der Unterpfad steht **nur** im Web-Build (`baseHref` der Konfiguration `web`); die Desktop-App nutzt weiter `/`.
Alles andere ist relativ zum `<base href>`: Bundles, Service Worker (`ngsw.json` → `/products/aba-x1/index.html`),
Manifest (`start_url`/`scope` „./“), MathLive-Schriften (`document.baseURI`), Rechen-Worker (`import.meta.url`).
`pnpm e2e` liefert den Build unter genau diesem Pfad aus und meldet jede 404 – ein absoluter Pfad fiele sofort auf.
Für ein anderes Ziel: `pnpm build:web --base-href /anderer/pfad/`.

Der Ordner ist rein statisch (kein Server): `index.html`, Bundles, `ngsw-worker.js` + `ngsw.json` (Service Worker),
`manifest.webmanifest`, Icons, MathLive-Schriften.

## Ziele

| Ziel | Schritte |
|---|---|
| **krocon.de/products/aba-x1** (gewählt) | `pnpm build:web`, den **Inhalt** von `dist/web/browser/` nach `/products/aba-x1/` hochladen (also `…/products/aba-x1/index.html`, `…/ngsw-worker.js` usw.); kein Fallback auf `index.html` nötig (keine Routen) |
| GitHub Pages (Alternative) | `docs/ci/pages.yml` (baut mit `--base-href /aba-x/`) nach `.github/workflows/` kopieren, Pages auf „GitHub Actions“ stellen, Workflow manuell starten |

## Server-Einstellungen

- `ngsw-worker.js` und `ngsw.json` **ohne** lange Cache-Dauer ausliefern (sonst kommen Updates spät an); gehashte
  Bundles dürfen lange gecacht werden.
- HTTPS ist Pflicht für den Service Worker (außer `localhost`); sein Gültigkeitsbereich ist `/products/aba-x1/`, er
  beeinflusst also keine anderen Seiten auf krocon.de.
- MIME-Typen prüfen: `.webmanifest` → `application/manifest+json`, `.woff2` → `font/woff2`, `.js` →
  `text/javascript` (der Rechen-Worker wird als ES-Modul geladen).
- Empfohlene Header:
  `Content-Security-Policy` (für den Pfad `/products/aba-x1/`): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self'; connect-src 'self'; manifest-src 'self'`,
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

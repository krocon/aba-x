# Design 018 – Einstellungen und Deutsch/Englisch

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen
- E1 Einstellungen: Winkel (RAD/DEG), Ergebnis exakt/dezimal, gültige Stellen (6–15), Zeitlimit (1–60 s), Farbschema
  der Seite (System/hell/dunkel), Sprache. Dokument `settings` (Schema 1), `sanitize` mit Grenzen, neuere Schemata
  nur lesen. SETUP-Softkey, Menü und ⌘/Strg+, öffnen den Dialog; jede Änderung gilt sofort.
- E2 Laufzeit-i18n (`core/i18n`): Kataloge EN/DE, Spec prüft Vollständigkeit und Platzhalter; Startsprache aus dem
  Browser. Das native Menü wird bei Sprachwechsel neu gebaut.
- E3 Bewusst englisch bleiben die Tastenbeschriftungen des Geräts (wie ein Rechner) und die Detailmeldungen des
  Mathe-Kerns (`MathError.message`) – offener Punkt in der Roadmap.
- E4 Farbschema über `data-theme` am Wurzelelement; die Gerätefarben bleiben fest (ADR 0006).

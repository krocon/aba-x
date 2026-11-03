# Barrierefreiheit und Performance

> Prompt 021 · Stand 02.11.2026 · Prüfung: `pnpm e2e` (axe-core 4.11 in Chromium und WebKit) und manuelle Durchgänge.

## Ergebnis axe

Keine Befunde der Stufen „serious“ oder „critical“ (Prüfung schlägt sonst fehl). Behoben während des Audits:
`aria-label` an Elementen ohne Rolle (Stack-Ebenen, Verlauf) → versteckter Text (`.visually-hidden`), Formeln
`aria-hidden`.

## Bedienung ohne Maus

| Bereich | Umsetzung |
|---|---|
| Eingabe | MathLive-Feld hat dauerhaft den Fokus; Tasten des Geräts stehlen ihn nicht (`pointerdown` abgefangen) |
| Alle Funktionen | über Hardware-Tastatur: F1–F6, Enter, Esc, Pfeile, ⌘/Strg-Kürzel (Übersicht ⌘/Strg+/) |
| Gerätetasten | jede mit `aria-label` („Square root“), Shift/Alpha mit `aria-pressed`, Softkeys mit F-Kürzel im Namen |
| Stack/Verlauf | gesprochener Text je Ebene („Level 1: x^2 + 1“), Auswahl mit `aria-current` |
| Dialoge | `role="dialog"`, `aria-modal`, Fokus hinein und zurück, Tab bleibt im Dialog, Esc schließt |
| Meldungen | Meldungszeile `role="status"`, Statuszeile `aria-live="polite"` |
| Plot | `role="img"` mit Beschreibung der Funktionen; Werte über TRACE/ANLYZ als Text in der Meldungszeile |
| Bewegung | `prefers-reduced-motion` schaltet Animationen ab |
| Farben | Seite hell/dunkel per Token; Gerät fest mit hohem Kontrast (LCD-Tinte auf Grün, weiße Tastenbeschriftung) |
| Zoom/Breite | 375 px ohne waagerechtes Scrollen (E2E-Prüfung) |

## Performance (gemessen)

| Messung | Wert |
|---|---|
| Web: Seitenaufruf bis Eingabefeld bereit (lokal, Chromium / WebKit) | ~130–190 ms / ~300 ms |
| Desktop (macOS, Release): Start bis vollständiges Gerät | < 1,5 s (Bildschirmfoto nach 1,5 s vollständig) |
| Initial-Bundle Web | 300 kB roh / 85 kB gzip; MathLive (188 kB gzip) und Rechen-Worker (142 kB gzip) werden nachgeladen |
| Release-Pakete macOS | `.app` 12 MB, `.dmg` 3,9 MB |

## Offen

- Screenreader-Durchgang mit VoiceOver/NVDA/Orca von Hand (axe ersetzt das nicht).
- Fehlermeldungen des Mathe-Kerns sind englisch (auch in der deutschen Oberfläche).

## ABA-T1 (Prompt 048)

- Jede Taste hat ein `aria-label` (Haupt-, Shift- und Alpha-Belegung), Shift/Alpha melden ihren Zustand; die Wippe ist
  per Tastatur bedienbar; die Hardware-Tastatur ist gleichwertig (Hilfe: Fußzeile „Keyboard“).
- Ergebnisse und Statuszeilen sind Live-Regionen; Grafiken (Plot, 3D, Geometrie, Statistik, Inferenz) haben eine
  Textalternative und eine Tabellen-/Num-Ansicht mit denselben Werten.
- Scrollbare Bereiche sind fokussierbar, Listen ohne verschachtelte Bedienelemente, Kontraste ≥ 4,5:1 (aktive Menütaste
  dunkler als die Akzentfarbe).
- Prüfung: `pnpm e2e --app aba-t1` – Szenario `accessibilitySweep` (axe über 14 Ansichten, hell und dunkel) und axe in
  den App-Szenarien; serious/critical lassen den Lauf scheitern.


# Prompt 017: Verlauf, Favoriten, Export/Import

> **Abhängigkeiten:** 002, 008 · **Aufwand:** M · **Betrifft:** Kern + Frontend + Persistenz
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/verlauf-export-import`. Design-Dokument: `prompts/017-verlauf-export-import.design.md`.

## 1. Ziel

HIST-Menü mit Berechnungsverlauf (wiederverwenden, favorisieren, löschen), dauerhaft gespeichert; Export/Import aller Nutzerdaten als JSON – gleiches Format auf Desktop und Web.

## 2. Architektur und Bezug

- ADR 0005, `FilesApi` (002), Dokumente `history`, `variables`, `functions`, `settings`

## 3. Umsetzung

1. Verlaufsmodell mit Grenze, Favoriten.
2. Export-Bündel mit Format-Version; Import mit Vorschau und Konfliktregel; neuere Version ablehnen statt beschädigen.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Verlaufslänge?** z. B. 500 Einträge.

## 4. Erwartete Dateien und Schnittstellen

- `features/history/*`
- `src/app/core/backup/backup-logic.ts`

## 5. Tests und Abnahmekriterien

**Tests**

- Export→Import-Roundtrip
- kaputte/neuere Dateien

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Export am Desktop, Import im Web und umgekehrt

## 6. Ausdrücklich nicht Teil dieses Prompts

- Cloud-Sync

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

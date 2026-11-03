# Prompt 045: ABA-T1 – Notizen, Info, Speicherverwaltung, Backup und Export/Import

> **Abhängigkeiten:** 033 · **Aufwand:** M · **Betrifft:** Frontend, Persistenz, ggf. Rust (`crates/shell`)
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) und [`000-ABA-T1-Master-Prompt.md`](000-ABA-T1-Master-Prompt.md)
> lesen. Branch `feat/t1-notizen-backup`. Design-Dokument: `prompts/045-t1-notizen-speicher-backup.design.md`.

## 1. Ziel

- **Notizen** (Shift+0): Notizkatalog und Editor mit einfacher Formatierung (fett, kursiv, Listen, Überschriften,
  Farben) und eingebetteten Formeln (Textbuch); **App-Info** (Shift+Apps) als Notiz je App.
- **Speicherverwaltung** (Shift+Toolbox „Mem“): Übersicht je Kategorie (Apps, Programme, Listen, Matrizen,
  Notizen, Variablen, Verlauf) mit Größe, Löschen mit Rückfrage.
- **Backup, Export/Import:** gesamtes Gerät als Backup-Datei (eigenes Format `aba-t1-backup`, versioniert);
  einzelne Objekte (App, Programm, Liste, Matrix, Notiz) exportieren/importieren; Desktop über native Dialoge, Web
  über Download/Datei-Auswahl (Fassade `FilesApi`); Import prüft Schema und Version, nie stilles Überschreiben.
- **Menü** (natives Desktop-Menü / HTML-Menü im Web) aus einem Modell: Datei (Export/Import/Backup), Ansicht,
  Hilfe, About.

## 2. Architektur und Bezug

- ABA-X1 017 (Verlauf/Export/Import, `BUNDLE_FORMAT`), 002/019 (Menü-Fassade, Kürzel je OS) – gemeinsame Teile nach
  `packages/core` herauslösen (024-Design §8: Menü-Fassade, Backup-Rahmen), Formate bleiben je App.
- Vorbild Kap. 28 (Notizen und Info), Kap. 2 (Speicherverwaltung).

## 3. Umsetzung

1. Dokumentschema je Objekttyp mit Version und Migration; Bundle-Format für Backup.
2. Notiz-Editor (Rich-Text-Modell als Daten, kein unescaptes HTML; Formeln über `<app-math>`).
3. Speicherübersicht aus `StorageApi`-Metadaten.
4. Menü-Fassade generisch, ABA-T1-Menümodell.

### Entscheidungsfragen (im Design-Dokument beantworten)

- Notizformat (eigenes JSON vs. Markdown-Teilmenge).
- Was teilen ABA-X1 und ABA-T1 beim Backup (Rahmen, Validierung) – ABA-X1-Format darf sich nicht ändern.

## 4. Erwartete Dateien und Schnittstellen

- `apps/aba-t1/src/app/features/{notes,memory,backup,menus}/*`, `packages/core/src/{menu,backup}/*`
- ggf. `crates/shell` (Dateidialoge, falls noch nicht geteilt)

## 5. Tests und Abnahmekriterien

**Tests**

- Schema-Validierung (kaputte/fremde/neuere Dateien → klare Meldung), Round-Trip aller Objekttypen, Migration.
- ABA-X1-Backup unverändert (bestehende Specs grün).

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Notiz mit Formel anlegen; Backup exportieren, Daten löschen, Backup importieren → alles wieder da (App und Web);
  einzelnes Programm exportieren/importieren.

## 6. Ausdrücklich nicht Teil dieses Prompts

- Austausch mit echten Geräten oder deren Formaten; Cloud-Synchronisation.

## 7. Doku

- `docs/architecture.md` (Formate), README (Backup), `prompts/README.md`

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- Formatbeschreibung; Review durch separaten Agenten (Persistenz, Import-Validierung)

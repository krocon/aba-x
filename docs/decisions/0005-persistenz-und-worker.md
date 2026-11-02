# ADR 0005 – Persistenz je Plattform, Rechnen im Web Worker

- Status: angenommen (Persistenz), vorgeschlagen (Worker – Prompt 004) · Datum: 02.11.2026

## Entscheidung
`StorageApi` mit Dokumenten je Schlüssel (`ui-state`, `settings`, `history`, `variables`, `functions`).
Desktop: JSON-Dateien im App-Datenordner, von Rust atomar geschrieben (Temp-Datei + Rename), kaputte Dateien als
`<key>.json.bad` beiseitegelegt, Schlüssel validiert (nie Pfade), 8 MiB Grenze. Web: IndexedDB-Objektspeicher
`documents`. Jedes Dokument trägt `schemaVersion`; Dokumente einer neueren Version werden gelesen, aber nie
überschrieben. CAS und aufwendige Numerik laufen in einem Web Worker mit Abbruch/Timeout.

## Folgen
+ Daten sind auf dem Desktop als Dateien sichtbar und sicher; Export/Import nutzt dasselbe Format auf beiden
Plattformen. − Zwei Implementierungen, beide mit Specs.

# ADR 0008 – ABA-T1: Identität, Gerät und gemeinsame Rust-Shell

- Status: angenommen · Datum: 03.11.2026 · Entscheidung Marc: Name ABA-T1, CAS bleibt Nerdamer (Prompt 025/029)

## Kontext
Der zweite Rechner orientiert sich am Bedienkonzept des HP Prime G2 (Master-Prompt ABA-T1). Er braucht eine
eigene Identität ohne Fremdmarken und eine Desktop-Hülle, die nicht kopiert wird.

## Entscheidung
- **Identität:** Produktname **ABA-T1** („Touch Graphing Calculator“), App-Ordner `apps/aba-t1`, Bundle-ID
  `io.github.krocon.abat1`, Web `krocon.de/products/aba-t1/`, Tags `aba-t1-v*`, IndexedDB `aba-t1`, Crate
  `aba-t1` (Lib `abat1_lib`), Dev-Server-Port 1421.
- **Look:** eigenes Gerät – tiefes Petrol als Gehäuse, elfenbeinfarbene Zifferntasten, Shift korallenrot, Alpha
  limettengrün, eigenes Logo (Kurve mit Berührungspunkt). Keine HP-Namen, -Logos, -Farben oder -Grafiken. Die
  Lage der Tasten folgt dem Bedienkonzept (Funktionsprinzip), die Gestaltung ist eigen.
- **Display:** fest 4:3 (Referenz 320 × 240), Inhalt skaliert über Container-Query-Einheiten (`cqw`); DOM für
  Text und Formeln, Canvas für Grafik (ab 033). Das Display ändert seine Größe nie.
- **Rust:** gemeinsame Crate `crates/shell` (`aba-shell`, Lib `aba_shell`) mit Storage, Dateien, Menü, About,
  Fehlern und `builder()`; jede App-Crate ist nur noch `aba_shell::builder().run(tauri::generate_context!())`.
  Kein Cargo-Workspace: jede Crate behält ihre `Cargo.lock` und ihr `target/`; die App-Crates hängen per Pfad an
  der Shell. `tauri-plugin-dialog` bleibt direkte Abhängigkeit jeder App, damit `tauri-build` die Rechte der
  Capabilities (`dialog:allow-save/open`) kennt. Notices zählen Pfad-Crates als eigene (`source == null`).
- **Abhängigkeiten:** bleiben zentral in der Root-`package.json` (024 E8); die npm-Liste der Notices ist für beide
  Apps gleich.

## Folgen
+ ABA-X1 unverändert (Bundle-ID, Daten, Notices identisch), Rust-Code nur einmal vorhanden.
+ `pnpm rust:*` (`scripts/rust.mjs`) und CI prüfen Shell und jede App-Crate auf allen drei Plattformen.
− Drei `Cargo.lock`-Dateien müssen bei Tauri-Updates gemeinsam angehoben werden.

## Nachtrag 03.11.2026 – Gerätefarben

Auf Wunsch von Marc folgt das Gerät jetzt dem vertrauten Farbschema dieser Geräteklasse: glänzend schwarzer oberer
Teil (Display, App-Tasten, Wippe), Tastenfeld in gebürstetem Metall, schwarze Funktions- und weiße Zahlentasten,
Shift hellblau, Alpha orange. Weiterhin gilt: eigener Name (ABA-T1), eigenes Logo und Schriftzug, keine Herstellernamen,
-logos, -grafiken oder Handbuchtexte. Die Farben stehen als `--dev-*`/`--key-*`/`--lcd-*`/`--metal-*`-Tokens in
`features/device/t1-device.css`.


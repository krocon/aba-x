# macOS: Signieren und Notarisieren

> Vorbereitet (Prompt 022), nicht eingerichtet. Vorlage: Files and Folders `docs/macos-signing.md`.

1. Apple Developer Program, Zertifikat „Developer ID Application“ erzeugen, als `.p12` exportieren.
2. Secrets im Repo: `APPLE_CERTIFICATE` (base64 der `.p12`), `APPLE_CERTIFICATE_PASSWORD`,
   `APPLE_SIGNING_IDENTITY` („Developer ID Application: Name (TEAMID)“).
3. Notarisierung bevorzugt per App-Store-Connect-API-Schlüssel: `APPLE_API_ISSUER`, `APPLE_API_KEY`,
   `APPLE_API_PRIVATE_KEY` (Inhalt der `.p8`).
4. `tauri.conf.json`: `bundle.macOS.hardenedRuntime` ist bereits `true`; Entitlements sind nicht nötig (kein Netz,
   keine Kamera, Dateien nur über den Systemdialog).
5. Prüfen: `spctl -a -vv ABA-X1.app`, `xcrun stapler validate ABA-X1.dmg`.

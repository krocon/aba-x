# Distribution

| Plattform | Pakete | Hinweise |
|---|---|---|
| macOS 12+ | `.dmg`, `.app` (universal: Apple Silicon + Intel) | unsigniert → Rechtsklick „Öffnen“ beim ersten Start |
| Windows 10/11 | `.msi`, NSIS `.exe` (Installation je Benutzer) | WebView2 wird bei Bedarf nachgeladen (`downloadBootstrapper`) |
| Linux | `.deb`, `.rpm`, `.AppImage` | `libwebkit2gtk-4.1` nötig (deb/rpm-Abhängigkeit) |
| Web | statischer Ordner | siehe `docs/deployment.md` |

Alle Pakete enthalten `THIRD-PARTY-NOTICES.txt` (Quelle `apps/aba-x1/THIRD-PARTY-NOTICES.txt`). Daten liegen im App-Datenordner (macOS
`~/Library/Application Support/io.github.krocon.abax/`, Windows `%APPDATA%\io.github.krocon.abax\`, Linux
`~/.local/share/io.github.krocon.abax/`) bzw. im Browser (IndexedDB) – Umzug über Export/Import.

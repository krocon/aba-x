# Technische Bewertung (Phase 0)

> Stand: 02.11.2026 · Grundlage: Master-Prompt §13 · Umgebung: macOS 27 (arm64), Node 24.21, pnpm 10.25,
> Rust 1.99.1, Xcode-CLT · Alle Zahlen wurden in diesem Repo bzw. in einem Wegwerf-Prototyp **gemessen**, nicht
> aus der Doku übernommen. Prototyp-Skript: [`docs/spikes/cas-capabilities.cjs`](spikes/cas-capabilities.cjs),
> Rohausgabe: [`docs/spikes/cas-capabilities.out.txt`](spikes/cas-capabilities.out.txt).

## 1. Ergebnis in Kürze

| Baustein | Entscheidung | Begründung (Details unten) |
|---|---|---|
| Eingabe | **MathLive 0.111.4** (MIT) | Beste natürliche Eingabe, läuft im Browser und in WKWebView, Fonts lokal bündelbar, lazy ladbar (188 kB gzip) |
| LaTeX → interne Struktur | **eigener Parser für das LaTeX-Subset von MathLive** | MathLives ASCII-Math-Ausgabe ist verlustbehaftet (Integrale); Compute Engine wäre 1,75 MB gzip nur fürs Parsen |
| CAS | **Nerdamer 2.0.1** (Apache-2.0) als erster Adapter | Exakte Ergebnisse, gute Integration/Gleichungen; bekannte Fallen werden im Adapter abgefangen |
| Numerik | **eigene TypeScript-Schicht** | Master-Prompt §3.5; Math.js bringt dafür nichts, kostet aber Bundle |
| Math.js | **nicht** im ersten Wurf | Kein CAS (simplify kürzt `(x²−1)/(x−1)` nicht), Gleitkomma-Default, 9 MB Paket |
| Compute Engine | **nicht** im ersten Wurf, Kandidat für einen zweiten CAS-Adapter | Sehr gutes MathJSON, aber 5,8 MB minified |
| Desktop | **Tauri 2.12**, Rust nur für Persistenz/Plattform | Walking Skeleton läuft auf macOS; Windows/Linux über CI-Matrix |
| Web | gleicher Angular-Build, Konfiguration `web` mit Service Worker | Offline nach dem ersten Laden geprüft |

Keine grundlegende technische oder lizenzrechtliche Entscheidung ist offen. Die **Projektlizenz MIT** hat Marc am
02.11.2026 bestätigt.

## 2. MathLive (Eingabe)

| Prüfpunkt | Ergebnis |
|---|---|
| Version, Lizenz, Pflege | 0.111.4, MIT, letzte Veröffentlichung 31.10.2026 – sehr aktiv |
| Einbindung Angular 22 (zoneless) | Element wird per `new MathfieldElement()` erzeugt und angehängt (kein `CUSTOM_ELEMENTS_SCHEMA` für das Feld nötig); `import('mathlive')` lädt es lazy |
| Bundle | 843 kB roh / **188 kB gzip** als eigener Lazy-Chunk; Initial-Bundle der App bleibt bei 174 kB roh / 52 kB gzip |
| Fonts offline | 20 KaTeX-`woff2` (296 kB) werden über `angular.json` nach `/mathlive/fonts` kopiert; `fontsDirectory` absolut gesetzt → im Browser 20/20 Fonts lokal geladen, kein CDN-Zugriff |
| Sounds | `soundsDirectory = null` – keine Netzwerk-/Dateizugriffe |
| Eingabe Brüche/Wurzeln/Integrale | per Tastatur (`/`, Tab zwischen Platzhaltern) und per `insert()` mit Platzhaltern (`#0`, `#?`) – im Browser geprüft (Chromium) |
| LaTeX-Export | sauber und regelmäßig, z. B. `\frac{x+1}{2}+\sqrt{2}\cdot\sin(x)+\int_0^1 x^2\,dx+\frac{d}{dx}x^3+\sum_{k=1}^{n}k` |
| ASCII-Math-Export | **verlustbehaftet:** `int _0^1x^2 d x`, `(d)/(d x)x^3` → für die Weiterverarbeitung ungeeignet |
| MathJSON | nur mit Compute Engine (siehe §4) |
| Statische Darstellung | `<math-span>` rendert Stack-Einträge ohne Editor (genutzt im Display) |
| Tauri/WKWebView (macOS) | ✅ Feld und Schriften gerendert, Tastenfeld-Klick fügt in die Zeile ein, `<math-span>` im Stack; Hardware-Tippen per Automation nicht prüfbar (manuell bestätigen) |
| WebView2 (Windows), WebKitGTK (Linux) | **nicht geprüft** (keine Maschine) – Aufgabe der CI-/E2E-Prompts 020/022 |

**Konsequenz:** Die Kette ist `MathLive → LaTeX → eigener Parser → AST`. Der Parser muss nur das LaTeX-Subset
können, das MathLive und unsere Tastatur erzeugen (Prompt 003).

## 3. CAS: Nerdamer 2.0.1 vs. nerdamer-prime 1.5.0

Nerdamer 2.0 ist ein TypeScript-Neuschrieb (Oktober 2026, Lizenz **Apache-2.0** statt früher MIT);
nerdamer-prime ist der MIT-Fork der 1.x-Linie.

| Fall | Nerdamer 2.0.1 | nerdamer-prime 1.5.0 | Referenz |
|---|---|---|---|
| `expand((x+1)^2)` | ✅ `1+2*x+x^2` (nur als `nerdamer(e).expand()`; `nerdamer.expand(e)` wirft) | ✅ | x²+2x+1 |
| `factor(x^3-6x^2+11x-6)` | ✅ `(-3+x)*(-2+x)*(-1+x)` | ✅ | |
| `simplify((x^2-1)/(x-1))` | ✅ `1+x` | ✅ | |
| `simplify(sin²+cos²)` | ✅ `1` | ✅ | |
| `diff(sin(x^2))` | ✅ `2*x*cos(x^2)` | ✅ | |
| `diff(ln(x)/x)` | ❌ **`0` – stillschweigend falsch** (`ln` unbekannt → Symbol) | ❌ `0` | (1−ln x)/x² |
| `diff(log(x)/x)` | ✅ `x^-2-x^-2*log(x)` | – | |
| `diff(foo(x))` | ❌ `foo` (unbekannte Funktion als Symbol) | – | Fehler erwartet |
| `integrate(x^2)` | ✅ `(1/3)*x^3` (exakt) | ⚠️ `0.3333…*x^3` (Gleitkomma) | x³/3 |
| `integrate(e^(-x^2))` | ✅ `(1/2)*pi^(1/2)*erf(x)` | ✅ | |
| `integrate(sqrt(1-x^2))` | ✅ kompakt | ⚠️ unvereinfacht | |
| `integrate(x^x)` | ✅ bleibt `integrate(x^x, x)` (ehrlich unausgewertet) | – | |
| `defint(x^2, 0, 1)` | ⚠️ `0.3333333333333333` (nur numerisch; Signatur `defint(f, x, a, b)`) | ⚠️ `0.333…` | 1/3 exakt |
| `solve(x^2-4)` | ✅ `{2, -2}` | ✅ | |
| `solve(e^x-2)` | ✅ `{log(2)}` | ❌ `261080729/376659873` (Näherung als Bruch!) | ln 2 |
| `solve(sin(x))` | ✅ `{_n*pi}` (allgemeine Lösung) | ❌ Liste falscher Brüche | nπ |
| `solve(x^5-x-1)` | ✅ numerische Wurzeln (gekennzeichnet als Dezimalzahl) | ⚠️ als Brüche | |
| Gleichungssystem `x+y=3, x-y=1` | ✅ `solveSystem` → `{x=2, y=1}` | – | |
| `limit(sin(x)/x, 0)` | ✅ `1` | ✅ | |
| `limit((1+1/x)^x, ∞)` | ✅ `e` | ❌ unausgewertet-kaputt | e |
| Brüche, `sqrt(8)`, `2^100`, `100!` | ✅ exakt (`1/2`, `2*2^(1/2)`, Ganzzahlen beliebiger Länge) | ⚠️ `0.5`, `factorial(100)` | |
| `1/0` | ✅ wirft `Division by zero` | – | Fehler |
| LaTeX ↔ Nerdamer | `convertFromLaTeX`/`convertToTeX` vorhanden | | (nicht genutzt: eigener Parser) |
| Laufzeit | alle Fälle < 10 ms | < 20 ms | |
| Bundle | **540 kB / 159 kB gzip** (esbuild, minified) | | |

**Entscheidung:** Nerdamer 2.0.1 als erster `SymbolicEngine`-Adapter (Prompt 009), im Web Worker. nerdamer-prime
scheidet aus (Gleitkomma statt exakt, falsche „Lösungen“).

**Pflichten des Adapters** (aus den Funden oben, Prompt 009):
1. Der Adapter serialisiert **unseren AST** nach Nerdamer-Syntax mit einer **Positivliste** von Funktionen
   (`ln → log`, `log10`, `arcsin → asin` …). Unbekannte Funktionen/Symbole werden **vorher** als Fehler
   `unknown-function` gemeldet – nie an Nerdamer durchgereicht (sonst `diff(ln(x)/x) = 0`).
2. Ergebnisse werden zurück in unseren AST geparst; enthalten sie `integrate(`, `defint(`, `limit(` o. Ä., gilt die
   Operation als **nicht gelöst** (`unsupported`/`not-solvable`) – der Ausdruck wird unausgewertet angezeigt.
3. Bestimmte Integrale: symbolisch als F(b) − F(a) aus der Stammfunktion; nur wenn das nicht geht, numerisch über
   unsere Quadratur – und dann als Näherung gekennzeichnet.
4. Dezimalzahlen in Ergebnissen (z. B. Wurzeln von x⁵−x−1) werden als **numerisch** markiert.
5. Referenztests aus Master-Prompt §6.2 plus jeder Fehlerfall dieser Tabelle als Regressionstest.

## 4. Math.js 15.2.0 und Compute Engine 0.177.0

| | Math.js | Compute Engine |
|---|---|---|
| Lizenz | Apache-2.0 | MIT |
| Paketgröße | 9,4 MB entpackt | 27,8 MB entpackt; **5,8 MB minified / 1,75 MB gzip** schon für `ce.parse` |
| Symbolik | `derivative` ✅; `simplify((x²−1)/(x−1))` kürzt **nicht**; kein Integrieren/Lösen | `D`, `Integrate` (∫₀¹x² = 1/3 exakt), Summen ✅ |
| Parsing | eigene Syntax | **LaTeX → MathJSON** sehr gut (`\log_2(8)`, `\sin^{-1}`, `\%`, Matrizen) |
| Zahlen | Gleitkomma-Default (`0.1+0.2 = 0.30000000000000004`), BigNumber/Fraction optional | exakt/rational |

**Entscheidung:** Keins von beiden im ersten Wurf. Math.js deckt nichts ab, was wir nicht ohnehin selbst bauen
(Numerik) oder mit Nerdamer haben. Die Compute Engine ist fachlich stark, aber zu groß, um sie nur als Parser
einzusetzen; sie bleibt Kandidat für einen **zweiten CAS-Adapter** hinter derselben Schnittstelle (Prompt 009
„Ausblick“), falls Nerdamer an Grenzen stößt.

## 5. Plattformen

| Prüfpunkt | Ergebnis |
|---|---|
| Angular 22.2 + Vitest 5 + jsdom | ✅ `pnpm test` (36 Specs), `ng lint` mit Import-Sperre für `src/math/` (Gegenprobe: Import von `@angular/core` in `src/math` → Lint-Fehler) |
| Tauri 2.12 Debug-Build macOS | ✅ `pnpm tauri build --debug --bundles app` → `ABA-X1.app` startet, Version/Plattform aus Rust |
| Persistenz Desktop | ✅ Modus wählen → `~/Library/Application Support/io.github.krocon.abax/ui-state.json`, nach Neustart wiederhergestellt |
| **CSP-Fund** | Tauri ergänzt `style-src` um Nonces → `'unsafe-inline'` wird ignoriert → Angular-Komponenten-Styles fehlten. Lösung wie FnF: `dangerousDisableAssetCspModification: ["style-src"]` |
| Persistenz Web | ✅ IndexedDB (Specs mit `fake-indexeddb`); ohne IndexedDB Hinweis in der Statuszeile statt Absturz |
| PWA | ✅ Web-Build mit `ngsw-worker.js`; nach erstem Laden „controlled“, MathLive-Fonts im Prefetch |
| Web Worker | Worker-Protokoll ist Prompt 004; Nerdamer läuft in Node ohne DOM → im Worker unkritisch, Messung dort |
| Windows / Linux | **nicht lokal geprüft** – CI-Matrix (`.github/workflows/ci.yml`) baut und testet Rust auf allen drei OS |

## 6. Lizenzen

| Komponente | Lizenz | Hinweis |
|---|---|---|
| Angular, MathLive, Compute Engine (nicht genutzt) | MIT | |
| Nerdamer 2.x | Apache-2.0 | NOTICE/Lizenztext in `THIRD-PARTY-NOTICES.txt` (über `pnpm notices`) |
| Tauri, Rust-Crates | MIT/Apache-2.0 u. a. | `pnpm notices` listet 384 Crates (Obermenge aller Zielplattformen) |
| fake-indexeddb (nur Tests) | Apache-2.0 | nicht im Produkt |

MIT für ABA-X1 ist mit allen eingesetzten Lizenzen verträglich (Apache-2.0-Komponenten bleiben Apache-2.0 und
werden mit Lizenztext ausgeliefert). **Von Marc am 02.11.2026 bestätigt.**

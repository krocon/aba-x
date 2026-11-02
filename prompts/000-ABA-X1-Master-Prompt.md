# ABA-X1 – Master-Prompt für Projektaufbau und Entwicklung

> **Ziel:** Entwickle ABA-X1, einen modernen wissenschaftlichen Taschenrechner mit Computer-Algebra-System (CAS),
> natürlicher mathematischer Darstellung und interaktivem Funktionsplotter – als **Desktop-App für macOS, Windows und
> Linux** (Tauri 2) **und** als **reine Webseite** (statisch, ohne Server), beide aus **einer** Codebasis.
>
> **Produktname:** ABA-X1
> **Produktbeschreibung:** Advanced Browser Algebra – Scientific & Symbolic Calculator
> **Technologie:** Angular 22 + TypeScript (UI und Mathematik), Tauri 2 + Rust (Desktop-Hülle), statischer Web-Build
> **Autor:** Marc Kronberg · **Repo:** https://github.com/krocon/aba-x · lokal `/Users/marckronberg/WebstormProjects/aba-x`
> **Vorbild für Aufbau, Werkzeuge und Arbeitsweise:** das Schwesterprojekt **Files and Folders (Tauri)**,
> lokal `/Users/marckronberg/WebstormProjects/files-and-folders-tauri` (im Folgenden „FnF“), dort vor allem
> `CLAUDE.md`, `prompts/000-arbeitsweise.md`, `prompts/README.md`, `package.json`, `src-tauri/`, `docs/ci/`,
> `docs/release.md`, `scripts/`. Nur lesen, nichts dort ändern.
> **Projektziel:** Ein hochwertiges, eigenständiges Open-Source-Produkt, dessen mathematischer Kern unabhängig von
> Angular **und** unabhängig von Tauri funktioniert.

---

## 1. Deine Rolle

Du agierst als erfahrener Softwarearchitekt, TypeScript- und Rust-Entwickler, Mathematik-/CAS-Spezialist und
UX-Designer.

Du sollst das Projekt nicht nur konzeptionell beschreiben, sondern schrittweise eine tatsächlich lauffähige, gut
getestete und dokumentierte Software implementieren.

Arbeite eigenständig, aber in kleinen, überprüfbaren Schritten. Lies zuerst das vorhandene Repository und seine
Konventionen, danach die Konventionen von FnF. Überschreibe keine vorhandene Arbeit ohne Notwendigkeit. Triff
sinnvolle technische Entscheidungen und dokumentiere sie.

**Wichtig:**
- Verwende Angular 22 und modernes TypeScript – zoneless, Signals, Standalone Components, `OnPush`.
- Verwende Tauri 2 für die Desktop-App; die Webseite ist derselbe Angular-Build ohne Tauri.
- Verwende keine unnötigen Drittanbieter-Abhängigkeiten.
- **Die gesamte Mathematik läuft in TypeScript** und ist damit in Web und Desktop identisch. Rust rechnet nicht.
- Die mathematische Kernbibliothek darf weder Angular noch `@tauri-apps/*` importieren (per Lint-Regel erzwungen).
- Keine Berechnungen ausschließlich in UI-Komponenten implementieren.
- Keine mathematischen Fähigkeiten vortäuschen, die die verwendeten Bibliotheken nicht tatsächlich unterstützen.
- Ergebnisse müssen mathematisch korrekt und durch Tests abgesichert sein.
- Bei nicht lösbaren symbolischen Problemen muss das System eine verständliche Rückmeldung oder einen nicht
  ausgewerteten Ausdruck liefern, statt ein falsches Ergebnis zu erzeugen.
- Jede Funktion, die es nur auf einer Plattform gibt (z. B. natives Menü, Dateidialog), ist hinter einer
  Plattform-Fassade versteckt und hat auf der anderen Plattform ein sinnvolles Gegenstück oder ist sichtbar
  deaktiviert – nie ein stiller Fehler.

---

## 2. Produktvision

ABA-X1 soll sich an hochwertigen wissenschaftlichen Taschenrechnern wie HP Prime und HP 50g orientieren, aber als
moderne Anwendung funktionieren – installiert auf dem Desktop oder direkt im Browser.

Die Anwendung soll drei Bedienmodi besitzen:

1. **Standard-Modus:** Klassischer wissenschaftlicher Taschenrechner mit natürlicher Eingabe und Ausgabe.
2. **CAS-Modus:** Symbolisches Rechnen, Algebra, Gleichungen, Ableitungen und Integrale.
3. **Graph-Modus:** Interaktiver Funktionsplotter mit Nullstellen, Extrempunkten, Schnittpunkten und
   Integrationsflächen.

Die Benutzeroberfläche soll eine hochwertige, eigenständige Identität erhalten. Sie darf sich funktional an
klassischen Rechnern orientieren, soll aber keine geschützten Designs, Logos oder proprietären UI-Elemente kopieren.

### 2.1 Zwei Auslieferungsformen, ein Produkt

| | Desktop-App (Tauri 2) | Webseite |
|---|---|---|
| Plattformen | macOS (universal: Apple Silicon + Intel), Windows 10/11 (x64, optional arm64), Linux (x64) | aktuelle Chromium-, Firefox- und Safari-Versionen |
| WebView/Engine | WKWebView (macOS), WebView2 (Windows), WebKitGTK (Linux) | Browser des Nutzers |
| Pakete | `.app`/`.dmg`, `.msi`/NSIS-`.exe`, `.deb`/`.rpm`/`.AppImage` | statische Dateien (`dist/…/browser`), z. B. GitHub Pages oder `krocon.de/products/aba-x` |
| Offline | immer | nach dem ersten Laden über einen Service Worker (PWA, installierbar) |
| Persistenz | JSON-Dateien im App-Datenordner, geschrieben von Rust (atomar, Schemaversion) | IndexedDB |
| Export/Import | native Dateidialoge | Download / Datei-Upload |
| Menü | natives Menü (macOS-Menüleiste; Windows/Linux nativ oder HTML, wie in FnF entscheiden) | HTML-Menü bzw. Toolbar |
| Tastenkürzel | je OS (`Cmd` auf macOS, `Ctrl` sonst) | wie Desktop, ohne Kürzel, die der Browser selbst belegt |
| Fenster | Größe/Position wird gemerkt, Mindestgröße | responsiv bis Smartphone-Breite |

Alles andere – Rechner, CAS, Plotter, Verlauf, Einstellungen, Barrierefreiheit – ist auf beiden identisch.

### Produktprinzipien

- Natürliches mathematisches Arbeiten statt einer reinen Textzeile.
- Exakte Ergebnisse, wo mathematisch möglich.
- Numerische Näherungen, wenn exakte Lösungen nicht möglich oder nicht sinnvoll sind.
- Klare Unterscheidung zwischen symbolischer und numerischer Berechnung.
- Schnelle, responsive Bedienung; die Desktop-App startet in unter einer Sekunde bis zur ersten Eingabe.
- Tastaturbedienung und virtuelle Rechner-Tastatur.
- Offline-fähig: Desktop immer, Web nach dem ersten Laden.
- Gute Barrierefreiheit und verständliche Fehlermeldungen.
- Datenschutzfreundlich: Berechnungen lokal, keine Telemetrie, keine Netzwerkzugriffe ohne ausdrückliche spätere
  Erweiterung (die Tauri-App bekommt keine Netzwerk-Capabilities).

---

## 3. Funktionaler Umfang

### 3.1 Grundrechenarten und wissenschaftliche Funktionen

Implementiere mindestens:

- Addition, Subtraktion, Multiplikation und Division
- Klammern und verschachtelte Ausdrücke
- Potenzen und Wurzeln
- Fakultät
- Prozentrechnung
- Betrag
- Kehrwert
- Sinus, Kosinus, Tangens und Umkehrfunktionen
- Hyperbolische Funktionen
- Exponentialfunktion und natürlicher Logarithmus
- Zehnerlogarithmus und Logarithmus zu beliebiger Basis
- Konstanten wie π und e
- Grad- und Bogenmaß
- Wissenschaftliche Schreibweise
- Komplexe Zahlen als spätere Ausbaustufe

### 3.2 Natürliche Darstellung / Textbuchdarstellung

Die Ein- und Ausgabe soll mathematische Ausdrücke so darstellen, wie man sie aus einem Mathematikbuch kennt.

Beispiele:

- Gestapelte Brüche
- Wurzeln mit horizontalem Wurzelstrich
- Hoch- und Tiefstellungen
- Verschachtelte Klammern
- Summen und Produkte
- Integrale mit Grenzen
- Ableitungen
- Matrizen und Vektoren
- Gleichungssysteme

Der Benutzer soll nicht gezwungen sein, LaTeX direkt einzugeben.

Prüfe **MathLive** als interaktives mathematisches Eingabefeld. Untersuche insbesondere:
- Tastatur- und Mausbedienung
- Eingabe von Brüchen, Wurzeln und Integralen
- LaTeX-Export
- strukturierte Repräsentation / MathJSON
- Einbindung in Angular 22 (Web Component, zoneless)
- **Verhalten in allen drei Tauri-WebViews** (WKWebView, WebView2, **WebKitGTK** – dort am ehesten Abweichungen bei
  Fonts, Custom Elements, Shadow DOM und virtueller Tastatur)
- Schriften offline gebündelt (kein CDN – sonst funktioniert weder die Desktop-App noch das Offline-Web)
- Lizenz und Wartungszustand

Verwende MathLive nicht unkritisch als mathematische Engine. Eingabe, interne Repräsentation, Berechnung und
Darstellung müssen sauber getrennt sein.

### 3.3 Variablen und Funktionen

Unterstütze:

- Variablen definieren, z. B. `a = 5`
- Funktionen definieren, z. B. `f(x) = x^2 - 3*x + 2`
- Variablen in Ausdrücken verwenden
- Funktionsaufrufe
- Variablen- und Funktionsverwaltung
- Speicherregister
- Konstanten
- Verlauf und Wiederverwendung vorheriger Ergebnisse

### 3.4 Symbolisches Rechnen (CAS)

Untersuche und integriere **Nerdamer** als mögliche erste CAS-Engine.

Funktionalitäten:

- Terme vereinfachen
- Ausmultiplizieren
- Faktorisieren
- Terme zusammenfassen
- Gleichungen lösen
- Gleichungssysteme lösen, soweit unterstützt
- Symbolische Ableitungen
- Symbolische Stammfunktionen
- Bestimmte Integrale, soweit unterstützt
- Grenzwerte, soweit unterstützt
- Exakte Brüche und algebraische Ausdrücke
- Substitution von Variablen
- Umformung und Darstellung von Ergebnissen

Prüfe die aktuelle API, TypeScript-Kompatibilität, Lizenz, Paketstruktur (ESM/CommonJS, Lauffähigkeit im Web
Worker) und tatsächliche Funktionsabdeckung von Nerdamer anhand der offiziellen Dokumentation und des Quellcodes.

Erstelle eine Capability-Matrix. Kennzeichne klar:
- vollständig unterstützt
- teilweise unterstützt
- nicht unterstützt
- nur mit Einschränkungen unterstützt

Nerdamer ist zunächst ein austauschbarer Adapter und darf nicht die interne Architektur dominieren. Eine
Rust-CAS-Engine im Tauri-Backend ist **kein** Ziel: Sie würde Web und Desktop auseinanderlaufen lassen.

### 3.5 Numerische Mathematik

Implementiere eine eigenständige TypeScript-Schicht für numerische Verfahren.

Mindestens:

- Numerische Auswertung von Ausdrücken
- Bisektionsverfahren
- Newton-Verfahren
- Sekantenverfahren
- Numerische Ableitung
- Trapezregel
- Simpson-Regel
- Gauß-Legendre-Quadratur
- Adaptive numerische Integration
- Fehler- und Konvergenzabschätzung, soweit sinnvoll
- Behandlung von Definitionslücken und numerischen Problemen

Numerische Verfahren müssen Grenzfälle berücksichtigen:
- Division durch null
- nicht definierte Funktionswerte
- Singularitäten
- unstetige Funktionen
- fehlende Konvergenz
- Über- und Unterläufe
- ungültige Integrationsintervalle

### 3.6 Integralrechnung

Unterscheide klar:

**Symbolische Integration**
- Unbestimmte Integrale
- Bestimmte Integrale, soweit die CAS-Engine diese unterstützt
- Ausgabe einer Stammfunktion
- Integrationskonstante `+ C`
- Rückmeldung bei nicht lösbaren Integralen

**Numerische Integration**
- Trapezregel
- Simpson-Regel
- Gauß-Legendre
- Adaptive Quadratur
- frei wählbare Grenzen
- einstellbare Genauigkeit
- Anzeige des numerischen Ergebnisses
- möglichst Anzeige einer Fehlerabschätzung

**Graphische Darstellung**
- Fläche zwischen Funktion und x-Achse markieren
- Integrationsgrenzen visualisieren
- optional positive und negative Flächen unterscheiden

### 3.7 Funktionsplotter

Entwickle einen interaktiven Plotter mit SVG oder Canvas.

Mindestens:

- Mehrere Funktionen gleichzeitig
- frei definierbare Funktionen
- Koordinatensystem
- Achsenbeschriftungen
- adaptives Raster
- Zoom und Verschieben (Maus, Trackpad-Gesten, Touch, Tastatur)
- automatische Skalierung
- Cursor mit Koordinatenanzeige
- Funktionswerte an ausgewählten Stellen
- Nullstellen markieren
- Extrempunkte markieren
- Schnittpunkte zwischen Funktionen
- Tangenten und Sekanten
- Integrationsflächen
- Definitionslücken möglichst sinnvoll visualisieren
- Umgang mit Sprüngen und Asymptoten
- Graph als PNG/SVG exportieren (Desktop: Speichern-Dialog, Web: Download)

Die mathematische Berechnung der Analysepunkte soll im Core erfolgen. Der Plotter ist nur für Darstellung und
Interaktion zuständig.

Vermeide das Verbinden von Punkten über erkannte Definitionslücken oder große unstetige Sprünge hinweg.

### 3.8 Historie und Persistenz

- Berechnungsverlauf
- Ergebnisse erneut verwenden
- Favoriten
- gespeicherte Funktionen
- Variablen und Konstanten
- Einstellungen (Sprache, Winkelmodus, Genauigkeit, Theme light/dark/System)
- Speicherung über **eine** Abstraktion `StorageApi` mit zwei Implementierungen:
  - Web: IndexedDB
  - Desktop: JSON-Dateien im App-Datenordner über Rust-Commands (nach Vorbild FnF `session.rs`/`settings.rs`/
    `fs_atomic.rs`: Schemaversion, `sanitize`, atomares Schreiben, kaputte Datei als `.bad` beiseitelegen, neuere
    Schemaversion nicht überschreiben)
- Export und Import von Benutzerdaten als JSON (gleiches Format auf beiden Plattformen, sodass Daten zwischen Web und
  Desktop umziehen können)

---

## 4. Technische Architektur

Trenne die Anwendung in klar definierte Schichten. Halte dich beim Aufbau an FnF: **ein** Angular-Projekt im
Repository-Root, `src-tauri/` daneben, kein Monorepo-Werkzeug. Der mathematische Kern liegt als eigener,
framework-freier Bereich im selben Projekt und kann später ohne Umbau als npm-Paket herausgelöst werden.

### 4.1 Vorgeschlagene Struktur

```text
aba-x/
├── CLAUDE.md                      # Leitfaden für Claude und Menschen (wie FnF: Stand, Befehle, Layout, Regeln)
├── README.md, LICENSE, CHANGELOG.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
├── THIRD-PARTY-NOTICES.txt        # generiert (pnpm notices), geprüft in pnpm check
├── package.json                   # einzige Versionsquelle; pnpm 10 über "packageManager"
├── angular.json                   # Konfigurationen: development, production (Desktop), web (PWA, base-href)
├── src/
│   ├── math/                      # Framework-freier Kern – KEIN Import von @angular/* oder @tauri-apps/*
│   │   ├── ast/                   # Expression-Typen, Result-/Fehler-Typen
│   │   ├── parser/                # Parser, Serializer (Text, LaTeX, MathJSON)
│   │   ├── symbolic/              # SymbolicEngine + Nerdamer-Adapter
│   │   ├── numeric/               # Auswertung, Nullstellen, Ableitung, Quadratur
│   │   ├── graph/                 # Sampling, Unstetigkeiten, Analysepunkte
│   │   └── worker/                # Worker-Protokoll (Nachrichten-Typen), Worker-Einstieg
│   ├── app/
│   │   ├── core/
│   │   │   ├── platform/          # PlatformApi: isDesktop(), TauriPlatform, WebPlatform
│   │   │   ├── storage/           # StorageApi: IndexedDbStorage, TauriFileStorage
│   │   │   ├── files/             # Export/Import: nativer Dialog vs. Download/Upload
│   │   │   ├── menu/              # Menümodell → natives Menü (Tauri) oder HTML
│   │   │   ├── actions/           # Aktionskatalog, Keymaps je OS (wie FnF)
│   │   │   ├── i18n/              # Deutsch/Englisch zur Laufzeit (wie FnF)
│   │   │   └── theme/             # Design-Tokens light/dark
│   │   ├── features/
│   │   │   ├── calculator/
│   │   │   ├── cas/
│   │   │   ├── graph/
│   │   │   ├── history/
│   │   │   ├── settings/
│   │   │   └── about/
│   │   └── shared/
│   ├── testing/                   # Fakes (FakeStorageApi, FakePlatform …), nie im Produktivcode importieren
│   └── styles.css                 # Design-Tokens
├── src-tauri/                     # Rust (Tauri 2) – dünn: Fenster, Menü, Persistenz, Dateien, About
│   ├── src/lib.rs, main.rs
│   ├── src/commands.rs            # dünne Command-Schicht
│   ├── src/storage.rs, fs_atomic.rs, settings.rs, window_state.rs, app_menu.rs, about.rs
│   ├── capabilities/              # minimale Rechte
│   ├── icons/
│   └── tauri.conf.json            # "version": "../package.json"
├── public/                        # Favicon, PWA-Manifest-Icons
├── scripts/                       # version.mjs, notices.mjs, licenses.mjs, release-notes.mjs (+ *.test.mjs) wie FnF
├── docs/
│   ├── architecture.md
│   ├── roadmap.md
│   ├── technical-evaluation.md
│   ├── decisions/                 # ADRs
│   ├── mathematics/
│   ├── user-guide/
│   ├── release.md, distribution.md, macos-signing.md
│   └── ci/                        # CI-/Release-Vorlagen
├── .github/workflows/             # ci.yml, release.yml, pages.yml (Web)
└── prompts/                       # 000-arbeitsweise.md, README.md (Index), NNN-<slug>.md, done/
```

Passe die Struktur an den tatsächlichen Projektstand an und begründe Abweichungen in `docs/architecture.md`.

### 4.2 Interne Expression-Repräsentation

Definiere eine eigene AST- bzw. Expression-Abstraktion.

Beispielhafte Knotentypen:

```typescript
type Expression =
  | NumberExpression
  | SymbolExpression
  | UnaryExpression
  | BinaryExpression
  | FunctionCallExpression
  | FractionExpression
  | PowerExpression
  | RootExpression
  | IntegralExpression
  | DerivativeExpression
  | SumExpression
  | MatrixExpression;
```

Die konkreten Interfaces müssen sinnvoll typisiert und erweiterbar sein. Der AST muss strukturiert klonbar
(`structuredClone`) und damit ohne Umwandlung über die Worker-Grenze übertragbar sein.

Anforderungen:
- Keine Abhängigkeit von Angular oder Tauri.
- Keine direkte Abhängigkeit von MathLive.
- CAS-Engines über Adapter anbinden.
- Numerische Auswertung unabhängig vom CAS ermöglichen.
- Konvertierung zu und von geeigneten Formaten vorsehen.
- Fehler und nicht unterstützte Operationen typisiert behandeln.

### 4.3 Engine-Interfaces

Entwirf klare Interfaces, zum Beispiel:

```typescript
interface SymbolicEngine {
  simplify(expression: Expression): MathResult<Expression>;
  expand(expression: Expression): MathResult<Expression>;
  factor(expression: Expression): MathResult<Expression>;
  differentiate(expression: Expression, variable: string): MathResult<Expression>;
  integrate(expression: Expression, variable: string): MathResult<Expression>;
  solve(expression: Expression, variable: string): MathResult<Expression[]>;
}
```

Die tatsächlichen Interfaces dürfen angepasst werden. Sie sollen die Fähigkeiten der Engine nicht stärker darstellen,
als sie tatsächlich sind.

Definiere zusätzlich:
- `NumericEngine`
- `ExpressionParser`
- `ExpressionSerializer`
- `MathRendererAdapter`
- `GraphSampler`
- `RootFinder`
- `Integrator`

### 4.4 Web Workers

Nutze Web Workers für rechenintensive Operationen, wenn dies einen messbaren Vorteil bringt – sie funktionieren im
Browser und in allen drei Tauri-WebViews gleich; in Phase 0 auf WebKitGTK verifizieren.

Insbesondere:
- symbolische Berechnungen
- numerische Integration
- Sampling komplexer Graphen
- umfangreiche Gleichungslösungen

Berechnungen müssen abbrechbar sein (Timeout, neue Eingabe verwirft die alte Anfrage). Vermeide unnötige
Worker-Komplexität bei trivialen Berechnungen.

### 4.5 Angular 22

Wie FnF:
- zoneless, Standalone Components, `OnPush`
- Signals für UI-Zustand; Stores als Services, Globales in Root-Services
- Dependency Injection, Plattformunterschiede nur über injizierte Fassaden (`PlatformApi`, `StorageApi`, `FilesApi`,
  `MenuApi`) – keine `isTauri()`-Abfragen verstreut in Features
- Lazy Loading für größere Funktionsbereiche (CAS, Graph)
- keine Geschäftslogik in Komponenten; reine Logik in `*-logic.ts`/`*-engine.ts` mit eigenen Specs
- Tastatur über ein zentrales Aktionssystem mit Keymaps je OS, nicht über verstreute `keydown`-Handler
- Texte zentral und übersetzbar (Deutsch/Englisch)
- Styling nur über Design-Tokens (light **und** dark)
- barrierefreie Bedienelemente
- Tests mit Vitest + jsdom über `ng test`

### 4.6 Tauri 2 (Desktop)

Rust ist bewusst dünn – nach Vorbild von FnF (`src-tauri/`), aber ohne dessen Dateimanager-Umfang:

- **Commands** nur für: Persistenz (`load_*`/`save_*`), Export/Import über Dateidialog, Fensterzustand,
  natives Menü aus einem Spec des Frontends, About-Daten (Version, Plattform). Logik in reinen Modulen ohne Tauri,
  mit `cargo test` getestet; Command-Schicht dünn; Fehler als `{ code, message }` (serde camelCase).
- **Sicherheit:** minimale Capabilities (kein `shell`, kein Netzwerk, Dateizugriff nur über eigene Commands bzw.
  Dialog-Plugin), strikte CSP in `tauri.conf.json`, keine Nutzerdaten unescaped in `innerHTML`.
- **Plugins** nur bei Bedarf und begründet (voraussichtlich `tauri-plugin-dialog`, ggf. `tauri-plugin-window-state`,
  `tauri-plugin-single-instance`; Updater erst in einer späteren Phase).
- Identifier z. B. `io.github.krocon.abax` (in Phase 0 festlegen), `version` aus `../package.json`.
- Dev-Server-Port wie FnF fest (z. B. 1420), `beforeDevCommand`/`beforeBuildCommand` auf die pnpm-Skripte.
- Rust stable, `cargo fmt`, `cargo clippy --all-targets -- -D warnings`, `cargo test`.
- Plattformspezifisches nur mit `#[cfg(target_os = …)]`; die CI kompiliert und testet auf allen drei OS.

### 4.7 Web-Build

- Gleiches Angular-Projekt, eigene Build-Konfiguration `web` (z. B. `pnpm build:web`): ohne Tauri-Aufrufe zur
  Laufzeit (`@tauri-apps/api` darf im Bundle sein, wird aber nur hinter `PlatformApi` dynamisch geladen),
  konfigurierbares `base-href`, Service Worker/Web-Manifest (PWA, offline), passende CSP-Header-Empfehlung.
- Keine Server-Komponente. Deployment als statische Dateien; Workflow für GitHub Pages vorbereiten, aber erst nach
  Freigabe aktivieren.
- Browser-Kompatibilität in der Doku festhalten; Playwright-Smoke-Test gegen den Web-Build (wie FnF
  `scripts/screenshots/`), der auch Screenshots für README und Doku erzeugen kann.

---

## 5. Benutzeroberfläche und Bedienkonzept

Entwickle eine moderne, hochwertige Oberfläche, die sich an wissenschaftlichen Taschenrechnern orientiert.

### 5.1 Grundlayout: Rechner-Gerät

> Entscheidung Marc (02.11.2026, ADR `docs/decisions/0006-geraete-look.md`): Die Oberfläche ist ein **Rechner-Gerät**
> im Stil klassischer Grafikrechner – eigenständig gestaltet, ohne Herstellernamen, Logos oder kopierte Grafiken.

```text
┌──────────────────────────────────────────┐
│ ABA-X1        SCIENTIFIC · SYMBOLIC · …  │
│ ┌──────────────────────────────────────┐ │
│ │ ◀⇧ ⇧▶ α  RAD EXACT                   │ │  Annunciators
│ │ { STANDARD }                         │ │  Modus/Pfad
│ │ 4:                                   │ │
│ │ 3:                            x² − 4 │ │  Stack (Ebene 1 unten),
│ │ 2:                    ∫₀¹ x²/√(1+x)dx│ │  natürliche Darstellung
│ │ 1:                            sin(x) │ │
│ │ ──────────────────────────────────── │ │
│ │ Eingabezeile (MathLive)              │ │
│ │ STD■│ CAS │GRAPH│ VARS│ HIST│SETUP   │ │  Softmenü (invertiert)
│ └──────────────────────────────────────┘ │
│ [F1] [F2] [F3] [F4] [F5] [F6]            │  Softkeys
│ Funktionstasten 6 Spalten, Shift-Funk-   │  Links-Shift violett,
│ tionen darüber, Alpha-Buchstaben rechts  │  Rechts-Shift türkis
│ ENTER  +/−  EEX  DEL  ⌫                  │
│ α  7 8 9 ÷ / ◀⇧ 4 5 6 × / ⇧▶ 1 2 3 − /   │  Ziffernblock 5 Spalten
│ ON 0 . SPC +                             │
└──────────────────────────────────────────┘
```

Das Display hat eine feste Größe (das Tastenfeld darf nie springen). Am PC ist die **Hardware-Tastatur
gleichwertig**: Tippen geht in die Eingabezeile, `Enter` = ENTER, `Esc` = Zeile leeren, `F1`–`F6` = Softkeys, die
passende virtuelle Taste leuchtet auf. Die Seite um das Gerät folgt hell/dunkel; das Gerät selbst hat feste Farben.
Mobile Browser (ab 375 px) werden unterstützt, die Desktop-Bedienung hat Priorität. In der Desktop-App gehören
Befehle wie Export/Import, Einstellungen und About ins native Menü; im Web in ein HTML-Menü – beide aus **einem**
Menümodell.

### 5.2 Rechner-Tastatur

Virtuelle Tasten für:
- Ziffern
- Grundrechenarten
- Klammern
- Potenzen
- Wurzeln
- Brüche
- Trigonometrie
- Logarithmen
- Konstanten
- Variablen
- Integral
- Ableitung
- Summen
- Löschen und Rückgängig
- Enter / Auswerten

Tastaturbelegung und Shortcuts je OS dokumentieren (macOS/Windows/Linux, Web).

### 5.3 Design

- Eigenständiges Branding für ABA-X1, App-Icon für alle Pakete und Favicon/PWA-Icons aus einer Quelle
- präzise Typografie (Schriften gebündelt, kein CDN)
- gut lesbare mathematische Ausdrücke
- klare Hierarchie zwischen Eingabe und Ergebnis
- Light- und Dark-Mode, Standard: System folgen
- dezente Akzentfarbe
- keine unnötigen Animationen, `prefers-reduced-motion` respektieren
- responsive Layouts
- hochwertige Fokus- und Hover-Zustände

Nicht das HP-Prime- oder HP-50g-Design kopieren. Die Geräte dienen nur als funktionale Inspiration.

---

## 6. Qualität und mathematische Korrektheit

Mathematische Korrektheit ist wichtiger als eine große Feature-Liste.

Erstelle eine umfassende Teststrategie.

### 6.1 Unit Tests

Teste insbesondere:

- Parser
- AST-Konvertierung
- Operator-Prioritäten
- Klammerung
- Exakte Brüche
- symbolische Vereinfachung
- Ableitungen
- Integrale
- Gleichungslösungen
- numerische Verfahren
- Graph-Sampling
- Nullstellen und Extrempunkte
- Fehlerfälle
- Plattform-Fassaden (Web- und Tauri-Implementierung gegen Fakes)
- Rust: Persistenz (Schema, `sanitize`, atomares Schreiben, kaputte/neuere Dateien), Menü-Spec-Validierung

Reine Engines bekommen – wie in FnF – Fallkataloge als `*.cases.json`, die die Specs tabellarisch durchlaufen.

### 6.2 Referenztests

Verwende bekannte mathematische Identitäten und Referenzwerte.

Beispiele:

```text
(x + 1)^2                 -> x^2 + 2*x + 1
d/dx sin(x^2)             -> 2*x*cos(x^2)
integral x^2 dx           -> x^3/3 + C
solve x^2 - 4 = 0         -> x = -2, x = 2
integral_0^1 x^2 dx       -> 1/3
```

Berücksichtige, dass CAS-Ausgaben äquivalent sein können, ohne textuell identisch zu sein. Vergleiche daher nach
Möglichkeit normalisierte mathematische Ausdrücke oder prüfe Ergebnisse durch Einsetzen bzw. Ableiten.

### 6.3 Property-based Tests

Wo sinnvoll:
- Ableitung und numerische Differenz vergleichen
- Stammfunktion ableiten und mit Ausgangsfunktion vergleichen
- numerische Integrationsverfahren gegen analytische Referenzwerte testen
- Parser und Serializer auf Roundtrip-Eigenschaften testen

### 6.4 Fehlerbehandlung

Fehler sollen verständlich und konkret angezeigt werden:
- Syntaxfehler
- unbekannte Variable
- ungültige Funktion
- Definitionsbereich verletzt
- Division durch null
- keine Konvergenz
- symbolisch nicht lösbar
- numerisch nicht auswertbar
- Berechnung abgebrochen (Timeout)
- Speichern/Laden fehlgeschlagen (Datei kaputt, Speicher voll, IndexedDB nicht verfügbar – z. B. privater Modus)

### 6.5 Ende-zu-Ende auf beiden Plattformen

- **Web:** Playwright gegen den Produktions-Web-Build (Chromium; Firefox/WebKit, soweit in der Umgebung möglich).
- **Desktop:** die App wirklich starten (`pnpm tauri dev` bzw. `pnpm tauri build --debug --no-bundle`) und die
  Akzeptanzkriterien durchspielen. In einer Umgebung ohne Display wie in FnF unter `Xvfb` (Screenshot, `xdotool`).
- Nicht prüfbare Plattformen (z. B. Windows/macOS aus einem Linux-Container) im Bericht ausdrücklich nennen; die
  CI-Matrix deckt sie ab.

### 6.6 Befehle (Zielzustand, Namen wie in FnF)

| Zweck | Befehl |
|---|---|
| Install | `pnpm install` |
| Web-Dev-Server | `pnpm start` |
| Desktop-Dev | `pnpm tauri dev` |
| Tests / Watch | `pnpm test`, `pnpm test:watch` |
| Lint / Format | `pnpm lint`, `pnpm format`, `pnpm format:check` |
| Build Desktop-Frontend / Web | `pnpm build`, `pnpm build:web` |
| E2E Web | `pnpm e2e` |
| Rust | `pnpm rust:fmt`, `pnpm rust:lint`, `pnpm rust:test` |
| Pakete | `pnpm tauri:build:mac`, `pnpm tauri:build:windows`, `pnpm tauri:build:linux` |
| Version | `pnpm version:check`, `pnpm version:set X.Y.Z` |
| Lizenzen | `pnpm notices`, `pnpm notices:check`, `pnpm licenses:report` |
| Alles prüfen | `pnpm check` (alles oben außer Paketen und E2E, plus `notices:check`) |

---

## 7. Roadmap und Entwicklungsphasen

Arbeite in klar abgegrenzten Phasen. Jede Phase muss einen lauffähigen und überprüfbaren Stand hinterlassen – **in
der Desktop-App und im Web-Build**.

### Phase 0 – Repository-Analyse und technische Validierung

- Repository untersuchen; FnF als Vorbild lesen (`CLAUDE.md`, `prompts/000-arbeitsweise.md`, `package.json`,
  `src-tauri/`, `docs/ci/`, `scripts/`).
- Toolchain feststellen: `node -v` (≥ 22.22.3), `pnpm -v` (10), `cargo -V` (stable), Tauri-CLI, Systemabhängigkeiten
  (Xcode CLT, WebView2, `libwebkit2gtk-4.1-dev` usw.).
- MathLive-Prototyp – im Browser **und** in einer minimalen Tauri-App (WebKitGTK/WKWebView/WebView2 soweit hier
  prüfbar).
- Nerdamer-Prototyp, auch im Web Worker.
- Math.js als mögliche Ergänzung evaluieren.
- Persistenz-Spike: IndexedDB im Web, JSON-Datei über Rust-Command im Desktop, gleiches Exportformat.
- Lizenz- und Wartungsstatus aller Abhängigkeiten (npm **und** Cargo) prüfen.
- Kleine Experimente für symbolisches Rechnen, natürliche Eingabe und Graphen implementieren.
- Ergebnisse in `docs/technical-evaluation.md` dokumentieren, Architekturentscheidungen in `docs/decisions/`.

**Abnahmekriterium:** Die wichtigsten Bibliotheken sind praktisch in Browser und Tauri-WebView getestet und die
Architektur ist begründet.

### Phase 1 – Walking Skeleton: Gerüst für Desktop und Web

- Angular 22 (zoneless) im Root, `src-tauri/` mit Tauri 2, Build-Konfigurationen für Desktop und Web.
- TypeScript-, ESLint- (inkl. Import-Sperre für `src/math/`), Prettier-, Vitest-Konfiguration wie FnF.
- `PlatformApi`/`StorageApi` mit Web- und Tauri-Implementierung, Fakes in `src/testing/`.
- Versions-Skripte, `pnpm check`, CI-Vorlage mit Matrix ubuntu/macOS/Windows (Frontend-Job + Rust-Job).
- Leeres Hauptfenster mit Modus-Umschalter läuft per `pnpm tauri dev` und als Web-Build.
- `CLAUDE.md`, `docs/architecture.md`, `docs/roadmap.md` angelegt.

**Abnahmekriterium:** Eine leere, aber echte App startet auf dem Desktop und im Browser; `pnpm check` ist grün.

### Phase 2 – Mathematischer Kern

- AST und Result-Typen implementieren.
- Parser-/Serializer-Grundlagen implementieren.
- Worker-Protokoll.
- Core ohne Angular und Tauri nutzbar und getestet.

**Abnahmekriterium:** Der mathematische Kern kann unabhängig von der Anwendung getestet werden.

### Phase 3 – Rechner und natürliche Darstellung

- Angular-Oberfläche implementieren.
- MathLive integrieren.
- virtuelle Tastatur aufbauen.
- Grundrechenarten implementieren.
- Variablen und Konstanten unterstützen.
- natürliche Ausgabe darstellen.
- Verlauf implementieren.

**Abnahmekriterium:** Ein Benutzer kann typische wissenschaftliche Berechnungen durchführen – in App und Web.

### Phase 4 – Symbolisches Rechnen

- CAS-Adapter implementieren (im Worker).
- Vereinfachen und Faktorisieren.
- Ausmultiplizieren.
- Gleichungen lösen.
- Ableitungen.
- symbolische Integrale, soweit unterstützt.
- Capability-Matrix und Fehlermeldungen.

**Abnahmekriterium:** Symbolische Operationen sind reproduzierbar und getestet.

### Phase 5 – Numerische Mathematik

- Funktionsauswertung.
- Nullstellenverfahren.
- numerische Ableitung.
- numerische Integration.
- Fehler- und Konvergenzbehandlung.
- Genauigkeitseinstellungen.

**Abnahmekriterium:** Numerische Verfahren liefern korrekte Ergebnisse für definierte Testfälle und behandeln
Problemfälle nachvollziehbar.

### Phase 6 – Graph-Modus

- SVG- oder Canvas-Plotter.
- mehrere Funktionen.
- Zoom und Pan.
- Cursor und Koordinaten.
- Nullstellen.
- Extrempunkte.
- Schnittpunkte.
- Tangenten.
- Integrationsflächen.
- Export als PNG/SVG.

**Abnahmekriterium:** Graphen sind interaktiv, performant und mathematisch plausibel.

### Phase 7 – Plattform-Integration und Produktreife

- Persistenz auf beiden Plattformen, Export/Import, Einstellungen, Deutsch/Englisch.
- Natives Menü (Desktop) und HTML-Menü (Web) aus einem Modell, Tastenkürzel je OS.
- Fensterzustand, About-Dialog, App-Icon.
- PWA: Service Worker, Manifest, Offline-Test.
- Tastaturbedienung, Barrierefreiheit, Performance, Browser-Kompatibilität.
- Dokumentation, Lizenz und Contribution Guide.

**Abnahmekriterium:** Beide Varianten sind im Alltag benutzbar und dokumentiert.

### Phase 8 – Distribution

- Pakete je OS (`.dmg`/`.app` universal, `.msi`/NSIS, `.deb`/`.rpm`/`.AppImage`).
- Release-Workflow (Tag → Build-Matrix → Entwurf eines GitHub-Release), Web-Deployment-Workflow.
- Signierung/Notarisierung (macOS) und Code-Signing (Windows) **vorbereiten und dokumentieren**, nicht ohne
  Zugangsdaten und Freigabe einrichten (`docs/release.md`, `docs/macos-signing.md`).
- Release Notes aus Conventional Commits, `THIRD-PARTY-NOTICES.txt` in jedem Paket.

**Abnahmekriterium:** Ein Release lässt sich reproduzierbar bauen; nichts wird ohne Freigabe veröffentlicht.

---

## 8. Entwicklungs-Prompts

Übernimm das Prompt-System von FnF:

- `prompts/000-arbeitsweise.md` – gemeinsame Regeln für alle Folge-Prompts, abgeleitet aus FnF
  `prompts/000-arbeitsweise.md` und an ABA-X1 angepasst (Phasen: Design-Dokument 🛑 Freigabe → Math-Core-Specs →
  Rust → Frontend → Ende-zu-Ende in App **und** Web → Doku → Abschlussprüfung; Definition of Done; Branch
  `feat/<slug>`, Conventional Commits, kein Push/Release ohne Anweisung).
- `prompts/README.md` – Index mit Reihenfolge, Abhängigkeiten, Aufwand und Status; erklärt, wie man einen Prompt in
  einer neuen Sitzung startet („Lies `prompts/000-arbeitsweise.md` und führe `prompts/003-….md` aus.“).
- Feature-Prompts `prompts/NNN-<slug>.md`, Design-Dokumente `prompts/NNN-<slug>.design.md` (Kopf: Status, Datum,
  Entscheidungen; unten „Fortschritt“ für Sitzungswechsel).
- Erledigte Prompts samt Design-Dokument per `git mv` nach `prompts/done/`; Nummern bleiben stabil, damit Verweise
  wie „004 E3“ in Code und Doku gültig bleiben.
- Dieser Master-Prompt bleibt als `prompts/000-ABA-X1-Master-Prompt.md` die Produktvision.

Folge-Prompts (Stand nach Phase 0; Index und Status in `prompts/README.md`):

```text
/prompts
  000-arbeitsweise.md
  README.md                                   (Index mit Status – maßgeblich)
  done/001-walking-skeleton-tauri-web.md      ✅
  002-plattform-fassaden.md
  003-expression-ast-parser.md
  004-worker-protokoll.md
  005-auswertung-standardmodus.md
  006-natuerliche-ausgabe.md
  007-aktionssystem-tastatur.md
  008-variablen-funktionen.md
  009-cas-adapter-nerdamer.md
  010-cas-modus-algebra-gleichungen.md
  011-ableitungen.md
  012-symbolische-integration.md
  013-numerische-verfahren.md
  014-funktionsplotter.md
  015-nullstellen-extrema-schnittpunkte.md
  016-integralflaechen.md
  017-verlauf-export-import.md
  018-einstellungen-i18n.md
  019-menue-tastenkuerzel-je-os.md
  020-pwa-offline-web-deployment.md
  021-barrierefreiheit.md
  022-release-distribution.md
  023-readme-screenshots-werbeseite.md
```

Jeder Prompt muss enthalten:

1. Ziel der Aufgabe.
2. Abhängigkeiten (welche Prompts vorher erledigt sein müssen).
3. Relevante Architektur – und was davon Web, Desktop oder beide betrifft.
4. Konkrete Implementierungsschritte und Entscheidungsfragen mit Optionen und Empfehlung.
5. Erwartete Dateien, Interfaces und ggf. Rust-Commands (Name, Parameter, Rückgabe, Fehlercodes).
6. Tests und Abnahmekriterien (Ende-zu-Ende in App **und** Web).
7. Was ausdrücklich nicht implementiert werden soll.
8. Welche Dokumentation zu aktualisieren ist.
9. Welche offenen Punkte am Ende zurückgemeldet werden müssen.

Die Prompts müssen aufeinander aufbauen und den aktuellen Projektstand berücksichtigen. Vermeide redundante oder
widersprüchliche Anweisungen; Gemeinsames steht nur in `000-arbeitsweise.md`.

---

## 9. Open-Source-Produkt und Repository

Bereite das Projekt für eine öffentliche Veröffentlichung vor.

- GitHub-Repository `krocon/aba-x` mit aussagekräftiger Beschreibung
- README mit Screenshots, Funktionsübersicht, Downloads je OS und Link zur Web-Version
- klare Lizenz (Vorschlag MIT wie FnF; Entscheidung begründen, mit den Lizenzen von MathLive, Nerdamer und ggf.
  Math.js abgleichen und vor Veröffentlichung bestätigen lassen)
- CONTRIBUTING.md
- CODE_OF_CONDUCT.md
- SECURITY.md
- CHANGELOG.md
- GitHub Issues und Templates
- CI mit Tests, Linting und Build für Web und alle drei Desktop-Plattformen
- reproduzierbare Builds (`pnpm install --frozen-lockfile`, `cargo --locked`)
- eine Versionsquelle (`package.json` → `tauri.conf.json`, `Cargo.toml`/`Cargo.lock` per `version:check` geprüft)
- Release-Tags und Release Notes
- Abhängigkeits- und Lizenzübersicht (npm und Cargo), `THIRD-PARTY-NOTICES.txt`

Erfinde keine bereits erfolgten Veröffentlichungen, URLs, Downloads oder Testergebnisse.

---

## 10. Branding

Produktname:

# ABA-X1

Langform:

**Advanced Browser Algebra**

Untertitel:

**Scientific & Symbolic Calculator**

Mögliche spätere Produktvarianten:
- ABA-X1 – Scientific Calculator
- ABA-X1 CAS – Computer Algebra System
- ABA-X1 Graph – Graphing Calculator

Der Name ist ein Arbeitsname, bis Domain-, Repository- und Markenverfügbarkeit geprüft wurden. Prüfe auch, ob die
Langform „Advanced *Browser* Algebra“ für eine installierbare Desktop-App noch passt, und mache ggf. Vorschläge –
entscheiden tut Marc.

Entwickle ein schlichtes, eigenständiges Logo und eine visuelle Identität, aus denen sich App-Icons (`.icns`, `.ico`,
PNG-Größen für Linux) und Web-Icons (Favicon, PWA) ableiten lassen. Vermeide eine Ähnlichkeit mit HP-, TI- oder
anderen geschützten Markenauftritten.

---

## 11. Nicht-Ziele für die erste Version

Nicht versuchen, direkt den vollständigen Funktionsumfang eines HP Prime nachzubauen.

Zunächst nicht erforderlich:
- vollständige Programmiersprache im Rechner
- umfangreiche Statistikpakete
- dynamische Geometrie
- 3D-Plotter
- vollständige numerische lineare Algebra
- symbolische Lösung beliebiger Gleichungssysteme
- vollständiger Ersatz für Mathematica, Maple oder Wolfram Alpha
- Mathematik in Rust oder WebAssembly (erst, wenn Messungen es rechtfertigen – dann für Web und Desktop gleich)
- Mobile Apps (Tauri iOS/Android), Auto-Updater, App-Store-Veröffentlichung
- Server, Benutzerkonten, Synchronisation zwischen Geräten

Diese Themen können später anhand tatsächlicher Nutzerbedürfnisse priorisiert werden.

---

## 12. Arbeitsweise und Regeln für den Agenten

1. Beginne mit einer Analyse des vorhandenen Repositories und lies die Vorbild-Dateien in FnF.
2. Frage nicht nach Informationen, die aus dem Repository ermittelt werden können.
3. Erstelle zunächst einen konkreten Implementierungsplan.
4. Implementiere nicht alle Phasen in einem einzigen unübersichtlichen Schritt.
5. Arbeite in kleinen, testbaren Änderungen auf einem Branch `feat/<slug>`; Commits nach jeder grünen Phase
   (Conventional Commits). **Kein Push, kein Release, kein Force-Push, kein Deployment** ohne ausdrückliche Anweisung.
6. Führe nach jeder relevanten Änderung Tests und Builds aus (`pnpm check`, bei Rust-Änderungen zusätzlich
   `pnpm tauri build --debug --no-bundle`).
7. Behebe Fehler, bevor du zur nächsten Phase übergehst. Rote Checks vor dem Start sind ein eigener Befund.
8. Dokumentiere Architekturentscheidungen.
9. Aktualisiere die passenden Prompts, `CLAUDE.md` und `docs/`, wenn sich Architektur, Befehle oder Regeln ändern.
10. Prüfe bei jeder neuen Abhängigkeit (npm oder Cargo) Lizenz, Wartung und Bundle-/Binärgröße; danach
    `pnpm notices`.
11. Verwende keine Bibliothek, ohne ihre tatsächlichen Fähigkeiten zu prüfen.
12. Erfinde keine mathematischen Ergebnisse.
13. Behandle symbolische und numerische Ergebnisse unterschiedlich.
14. Vermeide unnötige Abstraktionen, aber halte den Core modular und plattformfrei.
15. Prüfe jedes Feature in der Desktop-App **und** im Web-Build.
16. Halte das README und die Roadmap auf dem tatsächlichen Entwicklungsstand.

### Abschlussbericht jeder Entwicklungsaufgabe

Melde nach jeder Aufgabe (kurz, konkret):

- Was wurde implementiert?
- Welche Dateien wurden erstellt oder geändert?
- Welche Befehle und Tests liefen tatsächlich?
- Sind alle Checks grün?
- Auf welchen Plattformen wurde geprüft (Web-Browser, macOS, Windows, Linux) – und welche nicht, mit Grund?
- Welche bekannten Einschränkungen bestehen?
- Welche Aufgabe sollte als Nächstes folgen?
- Commits (Hash + Titel).

---

## 13. Dein erster Auftrag

Starte **nicht** sofort mit der vollständigen Implementierung.

Führe zuerst Phase 0 aus:

1. Analysiere das Repository und die vorhandene Umgebung; lies die Vorbild-Dateien in FnF.
2. Prüfe Node, pnpm, Angular 22, Rust und Tauri 2 samt Systemabhängigkeiten.
3. Untersuche MathLive, Nerdamer und Math.js anhand aktueller offizieller Informationen und praktischer
   Mini-Prototypen – im Browser und in einer minimalen Tauri-App.
4. Prüfe, wie sich MathLive-Ausdrücke zuverlässig in eine interne Expression-Struktur überführen lassen.
5. Teste symbolische Ableitung, Integration, Faktorisierung und Gleichungslösung, auch im Web Worker.
6. Prüfe die Persistenz in beiden Varianten (IndexedDB vs. Rust-JSON) mit gemeinsamem Exportformat.
7. Prüfe die Lizenzbedingungen aller vorgesehenen Abhängigkeiten (npm und Cargo).
8. Erstelle eine technische Bewertungsmatrix.
9. Erstelle einen konkreten Architekturvorschlag inkl. Plattform-Fassaden.
10. Lege `CLAUDE.md`, `prompts/000-arbeitsweise.md`, `prompts/README.md` und die Folge-Prompts an.
11. Aktualisiere README und Roadmap mit dem tatsächlichen Stand.

**Warte nach Phase 0 nicht auf eine allgemeine Freigabe, wenn alle notwendigen Informationen vorhanden sind.**
Präsentiere die Ergebnisse und beginne anschließend mit Phase 1 (Walking Skeleton für Desktop und Web), sofern keine
grundlegende technische oder lizenzrechtliche Entscheidung offen ist. Ab den Folge-Prompts gilt der Haltepunkt nach
dem Design-Dokument aus `prompts/000-arbeitsweise.md`.

Das Ziel ist ein wirklich nutzbarer, gut getesteter und langfristig wartbarer Taschenrechner – auf dem Desktop und im
Browser – nicht nur eine hübsche Demo.

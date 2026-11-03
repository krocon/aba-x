# ABA-T1 – Master-Prompt für den zweiten Rechner (Vorbild: HP Prime G2)

> **Ziel:** Ein zweiter Rechner im Monorepo (ADR 0007): ein **grafikfähiger Touch-Rechner mit CAS und App-Konzept**,
> dessen Bedienkonzept und Funktionsumfang sich am **HP Prime G2** orientieren – als Desktop-App (Tauri 2: macOS,
> Windows, Linux) **und** als Webseite (statisch, PWA), aus derselben Codebasis wie ABA-X1.
>
> **Arbeitsname:** ABA-T1 („T“ für Touch), App-Ordner `apps/aba-t1`. Name, Langform, Logo, Bundle-ID und Web-Pfad
> entscheidet Marc in Prompt 025 – bis dahin gilt der Arbeitsname in allen Prompts (bei Umbenennung per Suchen/
> Ersetzen nachziehen).
> **Technik und Arbeitsweise:** wie ABA-X1 – siehe `CLAUDE.md`, [`000-arbeitsweise.md`](000-arbeitsweise.md),
> [`000-ABA-X1-Master-Prompt.md`](000-ABA-X1-Master-Prompt.md) (Qualität §6, Open Source §9 gelten unverändert).
> **Quellen (nur als funktionale Referenz, nichts daraus kopieren):** HP Prime Benutzerhandbuch (c05942639, 765 S.,
> dt.), Quick-Start-Anleitung (c04773157), HPCC-2020-Vortrag „HP Prime – What's new in G2“, Produktfotos.

---

## 1. Was „nachbilden“ hier heißt – und was nicht

**Ja:** Bedienkonzept und Funktionsumfang als Vorbild – Startansicht (Home) und getrennte CAS-Ansicht, Eingabemodi
Textbuch/Algebraisch/RPN, kontextabhängige Touch-Menüleiste, App-Bibliothek mit den drei Ansichten
**Symbolisch / Grafisch / Numerisch** (+ jeweils Einstellungen), Toolbox-Menüs, Vorlagen-Taste, Kataloge und Editoren
(Listen, Matrizen, Programme, Notizen), Programmiersprache, Einheiten und Konstanten. Wer einen HP Prime bedienen
kann, soll sich sofort zurechtfinden: gleiche Tastengruppen, gleiche Shift-Logik, gleiche Ansichtswechsel.

**Nein (Marken- und Urheberrecht, Master-Prompt §5.3/§10, ADR 0006/0007):**
- kein „HP“, kein „Prime“, kein HP-Logo, keine Produktfotos, keine nachgezeichneten App-Icons oder Gehäusegrafiken;
  Fremdmarken nur als Vergleich in der Doku („orientiert sich am Bedienkonzept des HP Prime“).
- eigene Formgebung, Farben, Schrift und Icons – das Gerät darf als „Touch-Grafikrechner“ erkennbar sein, aber nicht
  wie ein HP Prime aussehen (z. B. eigene Gehäusefarbe, eigene Tastenformen, eigene Shift-/Alpha-Farben).
- keine Texte aus Handbuch oder Online-Hilfe übernehmen; Hilfetexte selbst schreiben.
- keine Firmware, kein ROM, keine Emulation; Giac/Xcas (GPL-3) nicht ohne Lizenzentscheidung (siehe §4).
- Dateiformate des Originals (`.hpprgm`, `.hpappdir`, Connectivity Kit) sind kein Ziel.

## 2. Produktbild

```text
┌───────────────────────────────────────────┐
│ ABA-T1                                 ◎  │  eigenes Logo
│ ┌───────────────────────────────────────┐ │
│ │ Funktion            RAD  ⚙  12:02    │ │  Titelzeile: App/Ansicht, Annunciators
│ │                                       │ │
│ │  Display 4:3 (Referenz 320 × 240,     │ │  Touch: Tippen, Wischen,
│ │  skaliert, scharf gerendert)          │ │  Ziehen, Pinch-Zoom
│ │                                       │ │
│ │ [Speich][Zurück][Sort.][ … ][   ][Start]│ │  6 Touch-Menütasten (kontextabhängig)
│ └───────────────────────────────────────┘ │
│ [Apps] [Symb]   ╭────╮   [Help] [Esc]      │  App-Tasten links, Wippe (Cursor)
│ [Home] [Plot]   │ ◎  │   [View] [CAS]      │  Mitte, System rechts
│        [Num ]   ╰────╯   [Menu]            │
│ Vars  Toolbox Vorlage x,t,θ,n a b/c ⌫      │  6 Spalten
│ xʸ    SIN     COS     TAN     LN    LOG    │
│ x²    +/−     ( )     ,       [  Enter  ]  │
│ EEX   7 8 9 ÷  ·  Alpha 4 5 6 ×            │  Ziffernblock, Shift/Alpha links
│ Shift 1 2 3 −  ·  On 0 . ␣ +               │
└───────────────────────────────────────────┘
```

Shift-Funktionen (Info, Setup, Settings, User, Copy, Paste, Clear, Mem, Units, Define, Chars, Sto▶, List, Matrix,
Program, Notes, Base, Ans, π, i, `{}`, `[]`, `≤≥≠`, `!,∞,→`, `|x|`, Eval, `""` …) und Alpha-Buchstaben A–Z stehen wie
beim Vorbild auf bzw. neben den Tasten (Lage gleich, Gestaltung eigen). Die Hardware-Tastatur ist gleichwertig.

## 3. Funktionsumfang und Zuordnung zu den Prompts

| Bereich (Vorbild: Handbuchkapitel) | Prompt | Umfang |
|---|---|---|
| Produktname, Logo, App-Gerüst, gemeinsame Rust-Crate | 025 | Pflicht |
| Gerät, Tastenfeld, Shift/Alpha, Wippe, Touch-Display, Menütasten (Kap. 2) | 026 | Pflicht |
| Startansicht, Textbuch/Algebraisch, Verlauf, Ans, Vorlagen, Variablen A–Z, Einstellungen (Kap. 2, 24) | 027 | Pflicht |
| RPN-Eingabemodus in der Startansicht (Kap. 3) | 028 | Pflicht |
| CAS-Ansicht, CAS-Einstellungen, CAS-Menü (Kap. 4, 23) | 029 | Pflicht |
| Toolbox (Math, CAS, App, Nutzer, Katalog), Zeichen, Hilfe (Kap. 2, 23) | 030 | Pflicht |
| Einheiten, Konstanten, Ganzzahl-Basen (Kap. 25, 30) | 031 | Pflicht |
| Listen und Matrizen (Katalog, Editor, Funktionen) (Kap. 26, 27) | 032 | Pflicht |
| App-Rahmen: Bibliothek, Symb/Plot/Num + Setup, Info, Speichern/Zurücksetzen (Kap. 6) | 033 | Pflicht |
| Funktionen-App inkl. FKT-Analyse (Kap. 7) | 034 | Pflicht |
| Parametrisch-, Polar-, Folge-App (Kap. 17–19) | 035 | Pflicht |
| Erweiterte Grafiken (Relationen, Ungleichungen) (Kap. 8) | 036 | Soll |
| Statistik 1 Var / 2 Var inkl. Regression (Kap. 12, 13) | 037 | Pflicht |
| Inferenz, Verteilungen (Kap. 14, Math-Menü Wahrscheinlichkeit) | 038 | Soll |
| Lösen-, Linearlöser-, Finanzen-, Dreiecklöser-App (Kap. 15, 16, 20, 21) | 039 | Pflicht |
| Explorer-Apps (linear, quadratisch, trigonometrisch) (Kap. 22) | 040 | Kann |
| Spreadsheet (Kap. 11) | 041 | Soll |
| Geometrie (dynamische Geometrie) (Kap. 10) | 042 | Soll |
| Programmiersprache (an HP PPL angelehnt): Kern (Kap. 29) | 043 | Pflicht |
| Programmkatalog, Editor, Debugger, eigene Apps, Nutzer-Tastenbelegung (Kap. 29) | 044 | Pflicht |
| Notizen, Info, Speicherverwaltung, Backup/Export/Import (Kap. 28) | 045 | Pflicht |
| 3D-Grafiken (neuere Firmware) | 046 | Kann |
| Python-App (MicroPython/WASM, neuere Firmware) | 047 | Kann |
| Produktreife: Barrierefreiheit, i18n, PWA, Release, README, Screenshots, Werbeseite | 048 | Pflicht |

**Nicht-Ziele:** Prüfungsmodus (Kap. 5 – in einer frei installierbaren App ohne Hardware-LED nicht sicher
durchsetzbar; höchstens später als „Übungsmodus“ ohne Sicherheitsversprechen), DataStreamer/Sensoren, drahtlose
Klassenzimmer-Funktionen, Connectivity Kit, Datenaustausch mit echten Geräten, Akku-/Energieoptionen.

## 4. Technische Leitplanken

- **Mathematik nur in `packages/math`** (oder einem neuen framework-freien Paket wie `packages/ppl` für die
  Programmiersprache, ESLint-Sperren analog). Neues gehört in `@aba/math`, wenn ABA-X1 es auch nutzen könnte
  (Statistik, Verteilungen, Matrizen, Einheiten, Finanzmathematik).
- **CAS-Engine:** ABA-X1 nutzt Nerdamer hinter `SymbolicEngine` (ADR 0004). Das Vorbild nutzt Giac, das deutlich
  mächtiger ist, aber **GPL-3** – eine Einbindung (z. B. giac.js/WASM) würde die Lizenz der ausgelieferten App
  bestimmen. Entscheidung in 029 (Optionen, Größe, Lizenz, Ladezeit) – bis dahin gilt: Nerdamer über den Adapter,
  jede Antwort verifiziert, Unbekanntes ehrlich ablehnen.
- **Gemeinsames herauslösen, wenn ABA-T1 es braucht** (024-Design §8): Graph-Zeichnen und Viewport, generischer
  Aktions-Dispatcher, Menü-Fassade, Settings-Rahmen, Verlauf/Variablen-Logik → `packages/core`; Rust-Gemeinsames →
  `crates/shell`. Nie aus `apps/aba-x1` importieren.
- **Display:** logisches Seitenverhältnis 4:3 (Referenz 320 × 240), gerendert in voller Auflösung (HiDPI, Vektor/
  Canvas), Schrift skalierbar. Das Display hat eine feste Größe innerhalb des Geräts; das Tastenfeld springt nie.
- **Touch und Zeiger:** Pointer Events (Maus, Stift, Finger) einheitlich; Gesten (Tippen, Ziehen, Wischen,
  Zwei-Finger-Pinch) mit Tastatur-Gegenstück. Desktop-Bedienung bleibt gleichwertig.
- **Persistenz:** eigener `STORAGE_DB_NAME` (z. B. `'aba-t1'`), eigenes Backup-Format, Apps/Programme/Listen/
  Matrizen/Notizen als versionierte Dokumente.
- **Web:** `krocon.de/products/aba-t1/` (Vorschlag, in 025 bestätigen), eigener Service-Worker-Scope.

## 5. Qualität

Master-Prompt ABA-X1 §6 gilt unverändert: Korrektheit vor Umfang, Referenz- und Property-Tests, Fehler als
`MathResult`, symbolisch und numerisch sichtbar unterschieden, Ende-zu-Ende in Desktop-App **und** Web-Build
(Chromium + WebKit, 375 px, hell/dunkel). Referenzbeispiele aus dem Handbuch dürfen als **Testfälle** (Eingabe →
erwarteter Wert) dienen, wenn die erwarteten Werte unabhängig nachgerechnet sind; Handbuchtexte werden nicht
übernommen.

## 6. Reihenfolge

```text
025 → 026 → 027 → 028 ─┐
            └→ 029 → 030 → 031 → 032 → 033 → 034 → 035 → 036
                                         ├→ 037 → 038
                                         ├→ 039 → 040
                                         ├→ 041 → 042
                                         └→ 043 → 044
045 nach 033 · 046/047 optional · 048 zuletzt
```

Index, Abhängigkeiten und Status: [`README.md`](README.md).

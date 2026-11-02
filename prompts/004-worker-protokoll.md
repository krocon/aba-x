# Prompt 004: Rechnen im Web Worker: Protokoll, Abbruch, Timeout

> **Abhängigkeiten:** 003 · **Aufwand:** M · **Betrifft:** Kern + Frontend (Desktop + Web)
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/worker-protokoll`. Design-Dokument: `prompts/004-worker-protokoll.design.md`.

## 1. Ziel

Aufwendige Berechnungen (CAS, Quadratur, Graph-Sampling) laufen in einem Web Worker – mit typisiertem Protokoll, Abbruch veralteter Anfragen und Timeout. Triviale Berechnungen bleiben im Hauptthread.

## 2. Architektur und Bezug

- ADR 0005 (Worker), Master-Prompt §4.4
- AST ist `structuredClone`-fähig (003)
- Tauri-CSP erlaubt `worker-src 'self'`; Angular baut Worker als eigene Datei

## 3. Umsetzung

1. Nachrichten-Typen in `src/math/worker/protocol.ts` (Anfrage mit Id, Art, AST; Antwort `MathResult`; Abbruch).
2. Worker-Einstieg und `MathWorkerClient` (Promise je Anfrage, `cancel`, Timeout → `timeout`-Fehler, Worker bei Hänger neu starten).
3. Regel, wann im Hauptthread gerechnet wird (Messung statt Bauchgefühl).
4. Prüfen, dass der Worker im Web-Build vom Service Worker gecacht wird und in WKWebView startet.

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Ein Worker oder ein Pool?** Empfehlung mit Messung.
- **Timeout-Standard?** z. B. 5 s, einstellbar in SETUP (018).

## 4. Erwartete Dateien und Schnittstellen

- `src/math/worker/{protocol,engine-host}.ts`
- `src/app/core/compute/math-worker.client.ts`, `compute.worker.ts`

## 5. Tests und Abnahmekriterien

**Tests**

- Protokoll-Specs ohne echten Worker (Fake-Port)
- Timeout und Abbruch
- Neustart nach Hänger

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- Eine künstlich lange Rechnung (Test-Hook) blockiert das Tastenfeld nicht; Esc/neue Eingabe bricht ab
- läuft im Web-Build offline und in der Desktop-App

## 6. Ausdrücklich nicht Teil dieses Prompts

- CAS-Adapter selbst (009)

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen
- `docs/architecture.md` (Worker)

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund
- gemessene Start-/Antwortzeiten des Workers in Browser und App

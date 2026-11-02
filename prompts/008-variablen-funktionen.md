# Prompt 008: Variablen, Funktionen, STO/RCL, VARS-Menü

> **Abhängigkeiten:** 005, 007 · **Aufwand:** M · **Betrifft:** Kern + Frontend + Persistenz
> Zuerst [`000-arbeitsweise.md`](000-arbeitsweise.md) lesen (Phasen, Haltepunkt nach dem Design 🛑, Definition of
> Done). Branch `feat/variablen-funktionen`. Design-Dokument: `prompts/008-variablen-funktionen.design.md`.

## 1. Ziel

`a = 5`, `f(x) = x^2-3x+2`, `f(2)`, STO/RCL über das Tastenfeld, VARS-Softmenü mit den eigenen Variablen; dauerhaft gespeichert (Dokumente `variables`, `functions`).

## 2. Architektur und Bezug

- Master-Prompt §3.3, ADR 0005 (StorageApi, schemaVersion)
- Softmenü: `device/softkeys.ts` (VARS ist heute „planned“)

## 3. Umsetzung

1. Umgebung (Scope) im Kern: Variablen, Funktionen, Rekursionsschutz, Konstanten schreibgeschützt.
2. Zuweisung/Definition im Parser (003) auswerten; STO legt Ebene 1 unter einem Namen ab, RCL holt.
3. VARS-Menü: Softkeys zeigen Variablennamen (Seiten mit NXT), Softkey fügt Namen ein, Shift-Softkey speichert.
4. Persistenz mit Schema-Version, Export/Import-Format vorbereiten (017).

### Entscheidungsfragen (im Design-Dokument beantworten)

- **Namensraum:** Groß-/Kleinschreibung, Unicode-Namen, Indizes (`x_1`)?

## 4. Erwartete Dateien und Schnittstellen

- `src/math/env/scope.ts`
- `features/vars/vars-store.ts`, Softmenü-Erweiterung

## 5. Tests und Abnahmekriterien

**Tests**

- Scope-Specs inkl. Zyklus `f(x)=f(x)`
- Persistenz mit FakeStorageApi, neuere Schemaversion

**Abnahme (Ende-zu-Ende in Desktop-App und Web-Build)**

- `a=5` ENTER, `2a` ENTER → `10`; nach Neustart noch da (App und Web)
- VARS-Softkeys zeigen `a`, `f`

## 6. Ausdrücklich nicht Teil dieses Prompts

- Programmiersprache

## 7. Doku

- `docs/roadmap.md` (Status, „Was funktioniert“), `prompts/README.md` (Status), README bei sichtbaren Änderungen

## 8. Am Ende zurückmelden

- Abschlussbericht nach `000-arbeitsweise.md` §2 Phase 7
- nicht geprüfte Plattformen mit Grund

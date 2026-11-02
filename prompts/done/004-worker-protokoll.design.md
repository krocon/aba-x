# Design 004 – Worker-Protokoll

- Status: umgesetzt · Datum: 02.11.2026 · Freigabe: entfällt (Auftrag „selbständig“)

## Entscheidungen
- E1 **Ein** Worker (`compute.worker.ts`) für alle CAS-Aufgaben; Numerik für Anzeige/Plot bleibt im Hauptthread
  (Mikrosekunden, kein Messwert spricht für einen Worker).
- E2 Protokoll `src/math/worker/protocol.ts` (Id + Aufgabe, Antwort `MathResult`), Ausführung `host.ts` – auch
  in-thread nutzbar (Tests, Umgebungen ohne Worker).
- E3 Zeitlimit 8 s (Standard), Abbruch über `cancelAll()`; beides **beendet den Worker** (eine hängende
  Nerdamer-Rechnung lässt sich anders nicht stoppen), der nächste Auftrag startet einen neuen.
- Neue Fehlercodes: `timeout`, `cancelled`.

## Fortschritt
- [x] Protokoll, Host, `ComputeClient` mit Specs (Timeout, Neustart, Abbruch, In-Thread-Fallback)
- [x] Ende-zu-Ende im Browser (Chromium, WebKit) und in der macOS-App unter der Tauri-CSP (mit Prompt 005)

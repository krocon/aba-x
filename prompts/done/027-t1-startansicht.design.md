# Design 027 – ABA-T1: Startansicht, Eingabe und Einstellungen

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 eigener Werte-Auswerter `@aba/math/value` (Real/Komplex, später Listen/Matrizen/Einheiten),
  der Reelles an `evaluateNumeric` delegiert – ABA-X1 unverändert · E2 Gleitkomma (double), Anzeige Standard mit
  12 signifikanten Stellen; keine Ganzzahl-Arithmetik beliebiger Länge in der Startansicht · E3 Verlauf 200 Einträge,
  gespeichert als Eingabe + Wert (Formatwechsel zeigt alte Ergebnisse neu) · E4 Lehrbuch = MathLive, Algebraisch =
  Textzeile mit Text-Parser · E5 `=` ist Test, `:=`/▶ speichern (wie das Vorbild) · E6 gemeinsames `MathField` in
  `@aba/core/shared` (ABA-X1 behält vorerst seine `MathInput`)

## Bausteine

| Baustein                                                        | Ort                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `Value`, `C` (komplex), `evaluateValue`, `format`               | `packages/math/src/value/` (+ 20 Specs), Worker-Op `evaluate`    |
| Katalog `re`, `im`, `conj`, `arg`                               | `functions.ts` (CAS-Adapter kennt sie nicht → ehrlich abgelehnt) |
| `MathField`                                                     | `@aba/core/shared/math-field`                                    |
| `HomeStore`, `home-logic`, `home-keys`, `templates`, `HomeView` | `apps/aba-t1/src/app/features/home/`                             |
| `SettingsStore`, `settings-logic`, `SettingsView`               | `apps/aba-t1/src/app/features/settings/`                         |
| `NavStore` (Bildschirme), `I18n`/Texte                          | `apps/aba-t1/src/app/core/`                                      |

## Fehlerfälle

Komplexe Ersatzergebnisse nur für Funktionen mit echtem komplexem Wert (√, ln, log, root, arcsin, arccos, arcosh,
artanh, Potenz); Rauschen < 10⁻¹⁴ relativ wird entfernt (e^{iπ} = −1). tan 90°, 0⁻¹, (−1)! bleiben Fehler.

## Fortschritt

- [x] Kern + Specs, Worker-Op · [x] Stores, Ansichten, Tasten · [x] E2E (Rechnen, PC-Tastatur, offline, axe)
- Hinweis ABA-X1: `re`, `im`, `conj`, `arg` sind jetzt Funktionsnamen (vorher implizites Produkt).

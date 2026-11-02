# CAS-Fähigkeiten (Nerdamer 2.0.1 hinter `SymbolicEngine`)

> Stand: Prompt 009 (02.11.2026). Belegt durch `src/math/symbolic/cas.spec.ts`. Jedes Ergebnis wird **numerisch
> stichprobenartig geprüft**; widerspricht es, wird es verworfen (Fehler `unsupported`), statt angezeigt zu werden.
> `verified: false` heißt „nicht prüfbar“ (z. B. freie Parameter), nie „widersprochen“.

| Fähigkeit | Status | Hinweise |
|---|---|---|
| Vereinfachen (`simplify`) | ✅ vollständig | exakte Brüche, Wurzeln (`√8 = 2√2`), trig. Identitäten, Spezialwerte (`sin π/6 = 1/2`) |
| Ausmultiplizieren (`expand`) | ✅ | |
| Faktorisieren (`factor`) | ✅ über ℚ | `x²+1` bleibt unfaktorisiert (korrekt über ℝ) |
| Ableiten (`differentiate`, Ordnung n) | ✅ | jede Stufe numerisch geprüft; `ln` wird als `log` übergeben (Nerdamer kennt `ln` nicht) |
| Stammfunktion (`integrate`) | 🟡 teilweise | elementare und viele rationale/trig. Integranden, `erf`; nicht elementar (`x^x`) → `not-solvable`, `Si(x)` u. Ä. → `unsupported` |
| Bestimmtes Integral | ✅ mit Einschränkungen | exakt als F(b) − F(a), **nur wenn die numerische Quadratur übereinstimmt**; divergente Integrale (∫₋₁¹ 1/x²) → Fehler; sonst numerischer Wert als Näherung |
| Gleichungen lösen (`solve`) | 🟡 teilweise | Polynome (auch Cardano), exp/log, trig. mit allgemeiner Lösung (Parameter n ∈ ℤ), leere Lösungsmenge; falsche Kandidaten werden aussortiert; Näherungen markiert |
| Gleichungssysteme (`solveSystem`) | 🟡 teilweise | lineare und einfache nichtlineare Systeme |
| Grenzwerte (`limit`) | 🟡 teilweise | Standardfälle (`sin x/x`, `(1+1/x)^x`); nicht existente Grenzwerte → `not-solvable` |
| Ungleichungen, Matrizen, komplexe Zahlen | ❌ nicht unterstützt | `unsupported` |
| Funktionen außerhalb der Positivliste (`nCr` wird umgeschrieben, `gcd`, `lcm` …) | ❌ im CAS | numerisch im Standardmodus verfügbar |

Zweiter Adapter (Ausblick): Die Compute Engine (MIT) könnte hinter derselben Schnittstelle laufen; Bundle-Größe
(1,75 MB gzip) spricht derzeit dagegen (`docs/technical-evaluation.md` §4).

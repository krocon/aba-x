# CAS von ABA-T1 – Abdeckung (Prompt 029)

Engine: Nerdamer 2 hinter `SymbolicEngine` (Entscheidung Marc 03.11.2026: kein Giac/GPL), ergänzt um eigene, reine
Verfahren. Jede Antwort wird numerisch gegengeprüft (`verify.ts`) oder ist durch Konstruktion exakt; schlägt die
Probe fehl, wird nichts angezeigt. „?“ in der Anzeige = Probe konnte nicht laufen (z. B. freie Parameter).

| Bereich (CAS-Menü des Vorbilds) | Befehl in ABA-T1 | Stand | Gegenprobe |
|---|---|---|---|
| Algebra: Vereinfachen, Erweitern, Faktorisieren | `simplify`, `expand`, `factor`, jede Eingabe ohne Befehl | ✅ | Gleichheit an Stichproben |
| Algebra: Partialbrüche | `partfrac(f, x)` | ✅ | Gleichheit |
| Algebra: Substituieren, Zähler/Nenner, linke/rechte Seite | – | ⬜ (030/Toolbox) | |
| Analysis: Ableiten | `diff`, d/dx-Vorlage | ✅ | numerische Ableitung |
| Analysis: Integrieren (unbestimmt/bestimmt) | `integrate`, ∫-Vorlage | ✅ | Ableitung bzw. Quadratur |
| Analysis: Grenzwerte | `limit` | ✅ | f nahe der Stelle |
| Analysis: Summen/Produkte | Σ/Π-Vorlage, `sum` | ✅ | explizite Summen n = a…a+5 |
| Analysis: Taylor | `taylor(f, x, n, a)` (n ≤ 12) | ✅ | aus geprüften Ableitungen |
| Analysis: Laplace | `laplace(f, t, s)` | ✅ | Quadratur bei s = 2, 3 |
| Analysis: inverse Laplace, FFT, Gradient, Divergenz, Rotation | – | ❌ (Engine kann es nicht) | |
| Lösen: Gleichung, System | `solve(eq, x)`, `solve([eq1, eq2], [x, y])` | ✅ | Einsetzen |
| Lösen: numerisch | `nsolve(f, x, Start)`, `nsolve(f, x, a, b)` | ✅ | Brent (Vorzeichenwechsel) |
| Lösen: komplex, DGL | – | ❌ | |
| Neu schreiben (exp/ln, trig) | – | ❌ (Nerdamer unzuverlässig) | |
| Ganzzahl: Faktoren, Primzahl, nächste/vorige Primzahl, φ, Teiler, Quotient/Rest, ggT/kgV | `ifactor`, `isprime`, `nextprime`, `prevprime`, `euler`, `divisors`, `iquo`, `irem`, `gcd`, `lcm` | ✅ (bis 2⁵³) | exakt (eigener Code) |
| Ganzzahl: Chinesischer Rest | – | ⬜ | |
| Polynom: Quotient/Rest, Grad, Koeffizienten, ggT/kgV | `quo`, `rem`, `degree`, `coeff`, `gcd`, `lcm` | ✅ | a = q·b + r, Neuaufbau, Teilbarkeit |
| Polynom: Nullstellen (exakt) | `solve` | ✅ | |
| Polynom: spezielle Polynome (Hermite …), Gröbnerbasis | – | ❌ | |
| Matrizen im CAS | – | ⬜ 032 | |

Eingabe: Befehlsnamen werden beim Tippen zu `\operatorname{…}` (MathLive-Kürzel) bzw. vor einer Klammer erkannt;
`a := …`, `f(x) := …` und `Wert ▶ name` legen CAS-Variablen/-Funktionen an; Startvariablen mit großem Anfangsbuchstaben
gehen als Zahlen ein.

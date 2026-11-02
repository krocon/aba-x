# ADR 0004 – Nerdamer 2 als erster CAS-Adapter

- Status: angenommen · Datum: 02.11.2026 · Belege: `docs/technical-evaluation.md` §3

## Entscheidung
`SymbolicEngine` wird zuerst mit Nerdamer 2.0.1 (Apache-2.0) umgesetzt, nicht mit nerdamer-prime (Gleitkomma,
falsche Lösungen). Der Adapter serialisiert nur Funktionen einer Positivliste, erkennt unausgewertete Ergebnisse
und kennzeichnet numerische Anteile. Nerdamer-Typen verlassen den Adapter nie.

## Folgen
+ Exakte Ergebnisse für Ableitung, Integration, Faktorisierung, Gleichungen. − Bekannte Fallen (`ln` unbekannt,
`defint` nur numerisch, `nerdamer.expand(string)` wirft) müssen im Adapter und in Regressionstests abgefangen
werden. Die Compute Engine bleibt Kandidat für einen zweiten Adapter.

# Finanzmathematik (`@aba/math/finance`, Prompt 039)

Rein und framework-frei (auch für ABA-X1 nutzbar). Alle Zinssätze in **Prozent**. Fehler sind `MathResult`
(`domain` für unbrauchbare Eingaben, `not-solvable`, wenn es keine Lösung gibt) – nie ein geratener Wert.

## Vorzeichenkonvention

Zahlungsstrom aus Sicht des Nutzers (wie bei den bekannten Finanzrechnern): **erhaltenes Geld positiv, gezahltes
negativ**. Ein Kredit über 200 000 hat PV = +200 000 und eine negative Rate PMT; ein Sparplan hat PV ≤ 0, PMT < 0 und
FV > 0. Haben alle Größen dasselbe Vorzeichen, gibt es keine Lösung (Meldung, kein Wert).

## Zeitwert des Geldes (TVM, `tvm.ts`)

Größen: N (Zahl der Zahlungsperioden), I%YR (nominaler Jahreszins), PV, PMT, FV, P/YR (Zahlungen pro Jahr),
C/YR (Zinsperioden pro Jahr), Zahlung am Periodenende (k = 0) oder -anfang (k = 1).

- Periodenzins: i = (1 + I%YR / (100·C/YR))^(C/YR / P/YR) − 1 (für C/YR = P/YR einfach I%YR / (100·P/YR)).
- Gleichung: PV + PMT·(1 + i·k)·(1 − (1+i)^−N)/i + FV·(1+i)^−N = 0; für i = 0: PV + PMT·N + FV = 0.
  (1 − (1+i)^−N)/i wird nahe i = 0 stabil über `expm1`/`log1p` berechnet.
- N, PV, PMT, FV: geschlossene Formeln. I%YR: alle Vorzeichenwechsel der Gleichung im Zins werden gesucht (Raster +
  Brent); mehrere Zinssätze → Warnung, geliefert wird der betragskleinste.
- Tilgungsplan (`amortizationSchedule`): Zinsanteil = −Restschuld·i (bei Anfang hat Rate 1 keinen Zinsanteil),
  Tilgung = PMT − Zins, Restschuld += Tilgung; Summen über Bereiche mit `amortize`. Die App zeigt den Plan je Rate oder
  je Jahr (Gruppen zu P/YR Raten) und auf Cent gerundet; gerechnet wird ungerundet.
- Referenz: Hypothek 200 000, 6 %, 30 Jahre, monatlich → PMT = −1 199,10; Summe der Tilgungen = −200 000, Zinsen
  gesamt −231 676,38.

## Zinsumrechnung

Effektiv = (1 + nominal/(100·C))^C − 1, stetig: e^(nominal/100) − 1; Umkehrung entsprechend (`effectiveToNominal`).
In der App bedeutet C = 0 „stetig“.

## Zahlungsströme (`cashflow.ts`)

CF0 zum Zeitpunkt 0, danach Gruppen gleicher Zahlungen CFj mit Häufigkeit Fj.

- NPV = Σ CF_t/(1+r)^t (Horner in 1/(1+r)), NFV = NPV·(1+r)^n.
- IRR: Nullstellen von NPV im Bereich −99 % … 10 000 % pro Periode (in u = ln(1+r), Raster + Brent). Mehr als ein
  Vorzeichenwechsel der Zahlungen kann mehrere IRR haben (Descartes): Alle gefundenen Sätze werden gemeldet, `irr` bleibt
  dann leer – nie ein still gewählter Wert. Kein Vorzeichenwechsel → keine IRR.
- MIRR = (FV⁺ / −PV⁻)^(1/n) − 1 (negative Zahlungen zum Finanzierungszins abgezinst, positive zum Wiederanlagezins
  aufgezinst). Amortisationsdauer (auch abgezinst) linear innerhalb der Periode interpoliert.

## Datum (`dates.ts`)

Kalender **proleptisch gregorianisch** (gregorianische Regeln auch vor 1582), Jahre 1 … 9999, Eingabe ISO
`JJJJ-MM-TT`, jedes Datum wird geprüft (29.02. nur in Schaltjahren). Tage zwischen zwei Daten: Kalendertage
(Tagesnummern nach H. Hinnant, `days_from_civil`) oder **30/360 US**: T1 = 31 → 30; T2 = 31 und T1 ≥ 30 → 30;
Tage = 360·ΔJ + 30·ΔM + ΔT (ohne Februar-Sonderregel). Dazu Datum + Tage und Wochentag (ISO).

## Abschreibung (`depreciation.ts`)

Ganze Jahre, Inbetriebnahme zu Beginn von Jahr 1. Linear: (Kosten − Restwert)/Dauer. Degressiv (DB): Satz =
Faktor/Dauer auf den Buchwert, nie unter den Restwert (optional Wechsel zur linearen, in der App aus). Digital (SYD):
(Dauer − j + 1)/(Dauer·(Dauer+1)/2) · (Kosten − Restwert).

## Weitere Blätter (`misc.ts`)

- Kostendeckung: Gewinn = Menge·(Preis − variable Kosten) − Fixkosten, nach jeder Größe auflösbar.
- Prozentänderung: neu = alt·(1 + p/100)^Perioden. Marge (vom Preis) und Aufschlag (auf die Kosten).
- Anleihe: Kurs je 100 Nennwert aus der Rendite (und umgekehrt per Brent), Kupons 1× oder 2× jährlich, 30/360 oder
  actual/actual; Stückzinsen und Kurs mit Stückzinsen. Konvention wie Tabellenkalkulationen (PRICE/YIELD).
- Black–Scholes–Merton (europäische Optionen, stetige Dividendenrendite): Call, Put, Delta, Gamma, Vega (je
  Prozentpunkt), Theta (je Jahr), Rho; Φ nach Hart/West (genau auch in den Rändern).

## Quellen

- Gleichungen und Konventionen: Lehrbuch-Finanzmathematik (z. B. Kruschwitz, *Finanzmathematik*) und die
  öffentlich dokumentierten Formeln gängiger Finanzrechner und Tabellenkalkulationen (PMT, IPMT, NPV, IRR, MIRR, PRICE,
  YIELD); Referenzwerte unabhängig nachgerechnet (Specs in `packages/math/src/finance/*.spec.ts`).
- Kalender: H. Hinnant, „chrono-Compatible Low-Level Date Algorithms“.
- Black–Scholes: F. Black, M. Scholes (1973), R. Merton (1973); Normalverteilung nach G. West, „Better approximations to
  cumulative normal functions“ (2005).

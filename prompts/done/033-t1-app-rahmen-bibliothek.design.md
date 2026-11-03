# Design 033 – ABA-T1: App-Rahmen und App-Bibliothek

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 App-Vertrag `AppDef` (Ansichten als Komponenten, `init()`, Zustandsversion) + `AppInstance`
  (eingebaut oder Kopie, Zustand JSON, Info) · E2 gemeinsame Plotfläche neu in `@aba/core/graph` (`PlotCanvas`,
  `plot-draw`), auf den Kern-Modulen `viewport`/`sampler`; ABA-X1s Graph bleibt unverändert (Umstellung später,
  wenn nötig) · E3 Canvas mit `role="img"` und Textalternative · E4 alle Apps im Haupt-Bundle (klein); Lazy Loading
  erst, wenn das Budget es verlangt · E5 statt Demo-App das Gerüst der Funktionen-App (034 vervollständigt sie)

## Fortschritt

- [x] Core: PlotCanvas, plot-draw · [x] App-Vertrag, Logik (3 Specs), Store, Bibliothek, Host, Info, Setup-Formular
- [x] Funktionen-App: Symb/Plot/Num/Setups (2 Specs) · [x] E2E (Bibliothek → F1 = X² → Plot → Tabelle)

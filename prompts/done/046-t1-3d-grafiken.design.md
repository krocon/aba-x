# Design 046 – ABA-T1: 3D-Grafiken

- Status: umgesetzt · Datum: 03.11.2026 · Freigabe: Marc („selbständig abarbeiten“)
- Entscheidungen: E1 Canvas 2D mit Maler-Algorithmus statt WebGL: keine Abhängigkeit, identisch in WKWebView, WebView2,
  WebKitGTK und Browsern; bei ≤ 80×80 Zellen schnell genug · E2 Kern `graph/surface.ts` (Gitter, Masken, Projektion,
  sortierte Flächen) · E3 Symb über die generische Kurven-Symb (Art `graph3d`) · E4 Textalternative über das Canvas-Label
  und die Num-Ansicht

## Fortschritt

- [x] Kern (3 Specs) · [x] Plot, Num, Setup, Registrierung, Hilfe · [x] E2E (FZ1 = X·Y, Tabelle)

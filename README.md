# ABA-X1

**Advanced Browser Algebra – Scientific & Symbolic Calculator**

A scientific calculator with a computer algebra system, natural (textbook) math notation and an interactive function
plotter – as a desktop app for **macOS, Windows and Linux** (Tauri 2) and as a **web app** that works offline, both
built from one Angular 22 code base. All mathematics runs locally in TypeScript, so the desktop app and the web
version give the same results.

> **Status: early development (v0.1.0).** The calculator device, natural input, keypad, hardware keyboard and the
> entry stack work. **Nothing is evaluated yet** – the expression core, CAS and plotter follow. See
> [`docs/roadmap.md`](docs/roadmap.md).

## What works today

- A calculator device in the spirit of classic graphing calculators (own design): LCD with stack levels 4–1,
  annunciators, an inverted soft menu and six softkeys, a 6 + 5 column keypad with left shift (violet), right shift
  (teal) and alpha letters.
- Natural math input (MathLive): fractions, roots, powers, integrals, sums, matrices – typed or from the keypad.
- Full hardware keyboard support: type anywhere, `Enter` pushes onto the stack, `Esc` clears the line, `F1`–`F6`
  press the softkeys, the matching on-screen key lights up.
- Stack operations: ENTER (empty line duplicates level 1), DROP, SWAP, RECALL, UNDO/REDO.
- Modes Standard / CAS / Graph (CAS and Graph are placeholders for now); the chosen mode is remembered.
- Desktop: data in JSON files in the app data folder (written atomically). Web: IndexedDB, installable PWA, offline
  after the first visit.

## Keyboard

| Key | Action |
|---|---|
| any character | goes to the input line |
| `Enter` | ENTER – push the line onto the stack |
| `Esc` | clear the input line |
| `F1` `F2` `F3` | Standard, CAS, Graph mode |
| `F4`–`F6` | VARS, HIST, SETUP (planned) |
| `Tab` | next placeholder in a fraction, integral, … |
| `Backspace` / `Delete` | delete backwards / forwards |

## Development

Requirements: Node ≥ 22.22.3, pnpm 10, Rust stable (≥ 1.90) and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) of your OS.

```bash
pnpm install
pnpm start          # web version on http://localhost:1420
pnpm tauri dev      # desktop app
pnpm check          # everything: versions, scripts, format, lint, tests, both builds, Rust, licences
```

More: [`CLAUDE.md`](CLAUDE.md) (commands, layout, rules), [`docs/architecture.md`](docs/architecture.md),
[`docs/technical-evaluation.md`](docs/technical-evaluation.md), [`docs/decisions/`](docs/decisions/).
Development runs through feature prompts in [`prompts/`](prompts/README.md).

## Licence

MIT (see [`LICENSE`](LICENSE)); third-party licences in [`THIRD-PARTY-NOTICES.txt`](THIRD-PARTY-NOTICES.txt).
ABA-X1 is an independent project and not affiliated with any calculator manufacturer.

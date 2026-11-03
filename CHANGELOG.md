# Changelog

All notable changes per app. Generated from Conventional Commits with `pnpm release:notes --app <app>` and edited.

## ABA-T1 0.1.0 – unreleased

First version of the touch graphing calculator (prompts 025–048). Not tagged yet – the release needs Marc's go.

### Features

- **aba-t1:** Python app with MicroPython in a worker, calc and graphic modules (prompt 047) (c299af6)
- **aba-t1:** program debugger, app programs and user keys (prompt 044) (ac840de)
- **ppl:** programming language package wired into ABA-T1 – catalogue, editor, terminal, home calls (prompt 043) (e41da19)
- **aba-t1:** solver apps – Solve, Linear Solver, Finance, Triangle Solver (prompt 039) (c4b1b3b)
- **aba-t1:** inference app and probability distributions in the catalogue (prompt 038) (7ee4c03)
- **aba-t1:** geometry app with dynamic constructions (prompt 042) (b612d55)
- **aba-t1:** spreadsheet app with formulas, names and CSV (prompt 041) (63cf206)
- **aba-t1:** statistics 1Var and 2Var apps with charts, fits and predictions (prompt 037) (6666276)
- **aba-t1:** advanced graphing app with guaranteed relation plots (prompt 036) (4165e05)
- **math:** statistics, regression, distributions and inference kernel (prompts 037/038) (e435c92)
- **ppl:** structured programming language core – parser, interpreter, host interface (prompt 043) (b452eff)
- **math:** dynamic geometry model – constructions, measurements, transformations (prompt 042) (208711a)
- **math:** finance, triangle and multi-variable solver kernels (prompt 039) (36160c0)
- **aba-t1:** 3D graphing app (prompt 046) (b93159c)
- **math:** interval arithmetic and implicit relation plotting kernel (prompt 036) (cbd4aad)
- **math:** spreadsheet engine – references, dependency graph, recalculation (prompt 041) (1c4bf93)
- **aba-t1:** linear, quadratic and trig explorer apps (prompt 040) (41186c1)
- **aba-t1:** notes, memory manager, backup and menus (prompt 045) (0ebd0da)
- **aba-t1:** parametric, polar and sequence apps (prompt 035) (c91337a)
- **aba-t1:** complete function app – trace, zoom, analysis, views (prompt 034) (2c1aa8c)
- **aba-t1:** app frame, library and the function app skeleton (prompt 033) (2540cd2)
- **aba-t1:** lists, matrices and linear algebra (prompt 032) (613a122)
- **aba-t1:** units, constants and based integers (prompt 031) (665a55b)
- **aba-t1:** toolbox, catalogue, variables, characters and help (prompt 030) (270e210)
- **aba-t1:** CAS view on an extended Nerdamer engine (prompt 029) (f104ec7)
- **aba-t1:** RPN entry mode with stack commands (prompt 028) (610ac9b)
- **aba-t1:** home view with textbook/algebraic entry and settings (prompt 027) (33f552e)
- **aba-t1:** keypad, shift/alpha, rocker, gestures, PC keyboard (prompt 026) (858d346)
- **aba-t1:** app skeleton of the second calculator (prompt 025) (0b8190f)
- **site:** symmetric layout, motion design, download links (78e3704)
- **site:** product page for ABA-X1 (6552a84)
- **device:** full-size mode – display and keypad fill the window (06c1004)
- **brand:** new app icon – ∫ in #a98fdb, x in #68cac3 on #262b37 (b0178dd)
- **calculator:** edit stack levels by click, show input and decimal value per level (3e1b026)
- **web:** host the web version under /products/aba-x1/ (krocon.de) (be965eb)
- PWA updates, E2E with axe, rendered-stack fix, release prep, README (020–023) (13e38bb)
- **graph:** function plotter with analysis and areas (014–016) (eb90b14)
- files, native/HTML menu, window state, about, history, export/import, settings, DE/EN (002, 017–019) (bbe0320)
- **cas:** CAS mode with SIMP/EXPA/FACT/SOLVE, calculus menu, verified operators (010–012) (e5f0184)
- **calculator:** stack browsing, keymaps per OS, alpha, variables and functions (006–008) (4776d5e)
- **calculator:** ENTER evaluates – exact via CAS, numeric fallback, RPN, →NUM (005) (4dd7042)
- **math:** numerics, verified CAS adapter on Nerdamer 2, compute worker (013, 009, 004) (e398e59)
- **math:** expression AST, text and LaTeX parser, serializers (003) (713f9f8)
- **calculator:** calculator device look with keypad and hardware keyboard (2c1fae1)
- walking skeleton for desktop (Tauri 2) and web (PWA) (1dbb932)

### Bug fixes

- **lint:** close package boundary holes; reject --app without a name (5fd03f7)

### Documentation

- **prompts:** ABA-T1 prompts 029–048 and index (fe92679)
- monorepo for several calculators (ADR 0007) (746d963)
- **prompts:** design 024 monorepo for several calculators (fc6a920)
- **prompts:** 024 monorepo for several calculators (43dcaf7)
- **site:** fix capitalisation (4befced)
- **site:** page target is krocon.de/products/aba-x/ (f35082f)
- **screenshots:** reproducible worked examples (pnpm screenshots:examples) (5b11cf1)
- record MIT licence confirmation (bf2a58d)
- phase 0 evaluation, ADRs, architecture, CLAUDE.md and follow-up prompts (777d4e7)
- **prompts:** master prompt for Tauri 2 desktop app and web version (0080c33)

### Other changes

- **shell:** move the generic Tauri shell into crates/shell (08b3460)
- **docs: add prompts for ABA-T1 device setup, start view, and RPN mode** (fd05f95)
- **core:** app identity, storage db name, i18n base (d4c9a22)
- **core:** move shared Angular blocks to packages/core (35a381a)
- **math:** move src/math to packages/math (534a28e)

## ABA-X1 0.1.1

See the [GitHub releases](https://github.com/krocon/aba-x/releases/) (tags `v0.1.0`, `v0.1.1`).

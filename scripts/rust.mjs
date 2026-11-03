#!/usr/bin/env node
// Rust checks of every crate (prompt 025): the shared shell (crates/shell) and the crate of every
// app in scripts/apps.mjs. Each crate keeps its own Cargo.lock (no Cargo workspace, ADR 0008).
//
//   node scripts/rust.mjs fmt|lint|test            all crates
//   node scripts/rust.mjs test --app aba-t1        the shell and one app
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPS, ROOT, appFromArgs, appPaths } from './apps.mjs';

export const SHELL_MANIFEST = join(ROOT, 'crates', 'shell', 'Cargo.toml');

const ARGS = {
  fmt: ['fmt', '--check'],
  lint: ['clippy', '--all-targets', '--', '-D', 'warnings'],
  test: ['test'],
};

/** The cargo calls of a check: the shell first, then each app. */
export function cargoCalls(check, apps, root = ROOT) {
  const args = ARGS[check];
  if (!args) throw new Error(`unknown check "${check}" – fmt, lint or test`);
  const manifests = [
    join(root, 'crates', 'shell', 'Cargo.toml'),
    ...apps.map((a) => appPaths(a, root).cargoToml),
  ];
  return manifests.map((m) => {
    const [cmd, ...rest] = args;
    const sep = rest.indexOf('--');
    const head = sep < 0 ? rest : rest.slice(0, sep);
    const tail = sep < 0 ? [] : rest.slice(sep);
    return [cmd, '--manifest-path', m, ...head, ...tail];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const explicit = argv.some((a) => a === '--app' || a.startsWith('--app=')) || !!process.env.APP;
  const { app, rest } = appFromArgs(argv, process.env);
  const apps = explicit ? [app] : Object.keys(APPS);
  for (const call of cargoCalls(rest[0], apps)) {
    console.log(`cargo ${call.join(' ')}`);
    execFileSync('cargo', call, { stdio: 'inherit' });
  }
}

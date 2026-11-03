import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cargoCalls } from './rust.mjs';

test('every check runs on the shell and on each app crate', () => {
  const calls = cargoCalls('lint', ['aba-x1', 'aba-t1'], '/r');
  assert.deepEqual(
    calls.map((c) => c[2]),
    [
      '/r/crates/shell/Cargo.toml',
      '/r/apps/aba-x1/src-tauri/Cargo.toml',
      '/r/apps/aba-t1/src-tauri/Cargo.toml',
    ],
  );
  assert.deepEqual(calls[0], [
    'clippy',
    '--manifest-path',
    '/r/crates/shell/Cargo.toml',
    '--all-targets',
    '--',
    '-D',
    'warnings',
  ]);
  assert.deepEqual(cargoCalls('fmt', [], '/r')[0], [
    'fmt',
    '--manifest-path',
    '/r/crates/shell/Cargo.toml',
    '--check',
  ]);
});

test('unknown checks are rejected', () => {
  assert.throws(() => cargoCalls('build', []), /unknown check/);
});

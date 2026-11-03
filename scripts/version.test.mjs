import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { APPS } from './apps.mjs';
import {
  cargoLockVersion,
  cargoTomlVersion,
  checkApps,
  checkVersions,
  isSemver,
  setCargoLockVersion,
  setCargoTomlVersion,
  setVersion,
} from './version.mjs';

const TOML = `[package]
name = "aba-x"
version = "0.1.0"

[dependencies]
serde = { version = "1.0" }
foo = "2"
`;
const LOCK = `[[package]]
name = "foo"
version = "2.0.0"

[[package]]
name = "aba-x"
version = "0.1.0"
dependencies = []
`;

test('the repository is consistent', () => {
  assert.deepEqual(checkApps(Object.keys(APPS)), []);
});

test('semver', () => {
  assert.ok(isSemver('1.2.3'));
  assert.ok(isSemver('1.2.3-beta.1'));
  assert.ok(!isSemver('1.2'));
  assert.ok(!isSemver('v1.2.3'));
});

test('Cargo.toml: reads and writes only the package version', () => {
  assert.equal(cargoTomlVersion(TOML), '0.1.0');
  const next = setCargoTomlVersion(TOML, '0.2.0');
  assert.equal(cargoTomlVersion(next), '0.2.0');
  assert.match(next, /serde = \{ version = "1.0" \}/);
});

test('Cargo.lock: only our crate', () => {
  assert.equal(cargoLockVersion(LOCK, 'aba-x'), '0.1.0');
  const next = setCargoLockVersion(LOCK, '0.2.0', 'aba-x');
  assert.equal(cargoLockVersion(next, 'aba-x'), '0.2.0');
  assert.equal(cargoLockVersion(next, 'foo'), '2.0.0');
});

test('mismatches are reported per file', () => {
  const problems = checkVersions(
    {
      pkg: { version: '0.2.0' },
      tauriConf: { version: '0.1.0' },
      cargoToml: TOML,
      cargoLock: LOCK,
    },
    'aba-x',
  );
  assert.equal(problems.length, 3);
  assert.deepEqual(
    checkVersions(
      {
        pkg: { version: '0.1.0' },
        tauriConf: { version: '../package.json' },
        cargoToml: TOML,
        cargoLock: LOCK,
      },
      'aba-x',
    ),
    [],
  );
});

/** A repository with two apps in a temp folder (prompt 024). */
function twoApps() {
  const root = mkdtempSync(join(tmpdir(), 'aba-version-'));
  const apps = {
    'aba-x1': { ...APPS['aba-x1'] },
    other: { ...APPS['aba-x1'], dir: 'apps/other', crate: 'other' },
  };
  for (const [name, app] of Object.entries(apps)) {
    const dir = join(root, app.dir, 'src-tauri');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(root, app.dir, 'package.json'), JSON.stringify({ name, version: '0.1.0' }));
    writeFileSync(join(dir, 'tauri.conf.json'), JSON.stringify({ version: '../package.json' }));
    writeFileSync(join(dir, 'Cargo.toml'), TOML.replace('aba-x', app.crate));
    writeFileSync(join(dir, 'Cargo.lock'), LOCK.replace('"aba-x"', `"${app.crate}"`));
  }
  return { root, apps };
}

test('several apps: each has its own version, a mismatch names its app', () => {
  const { root, apps } = twoApps();
  assert.deepEqual(checkApps(['aba-x1', 'other'], root, apps), []);
  setVersion('other', '0.3.0', root, apps);
  assert.deepEqual(checkApps(['aba-x1', 'other'], root, apps), []);
  const other = JSON.parse(readFileSync(join(root, 'apps/other/package.json'), 'utf8'));
  const aba = JSON.parse(readFileSync(join(root, 'apps/aba-x1/package.json'), 'utf8'));
  assert.equal(other.version, '0.3.0');
  assert.equal(aba.version, '0.1.0');
  writeFileSync(join(root, 'apps/other/src-tauri/Cargo.toml'), TOML.replace('aba-x', 'other'));
  assert.deepEqual(checkApps(['aba-x1', 'other'], root, apps), [
    'other: Cargo.toml: version "0.1.0" ≠ package.json "0.3.0"',
  ]);
});

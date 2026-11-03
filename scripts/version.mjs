#!/usr/bin/env node
// Version: one source of truth per app (adopted from Files and Folders, design 017 E3; per app
// since prompt 024). For every app in scripts/apps.mjs, relative to apps/<app>/:
//
//   package.json            "version"            ← the source
//   src-tauri/tauri.conf.json "version": "../package.json"  (Tauri reads package.json)
//   src-tauri/Cargo.toml    [package] version    ← kept in sync by this script
//   src-tauri/Cargo.lock    our package entry    ← kept in sync by this script
//
//   node scripts/version.mjs check                    exit 1 if anything differs (all apps)
//   node scripts/version.mjs check --app aba-x1       one app
//   node scripts/version.mjs set 0.2.0 [--app aba-x1] writes package.json, Cargo.toml, Cargo.lock
//
// No tags, no commits – that stays a manual, approved step (docs/release.md).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { APPS, ROOT, appConfig, appFromArgs, appPaths } from './apps.mjs';

export { ROOT };
export const TAURI_VERSION_REF = '../package.json';

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function isSemver(v) {
  return typeof v === 'string' && SEMVER.test(v);
}

/** `version` of the `[package]` table (not of a dependency). */
export function cargoTomlVersion(toml) {
  const pkg = /^\[package\]\s*$([\s\S]*?)(?=^\[|$(?![\s\S]))/m.exec(toml);
  const m = pkg && /^version\s*=\s*"([^"]*)"/m.exec(pkg[1]);
  return m ? m[1] : null;
}

export function setCargoTomlVersion(toml, version) {
  return toml.replace(/^(\[package\]\s*$[\s\S]*?^version\s*=\s*")[^"]*(")/m, `$1${version}$2`);
}

const lockEntry = (name) =>
  new RegExp(`(\\[\\[package\\]\\]\\s*\\nname = "${name}"\\s*\\nversion = ")([^"]*)(")`);

export function cargoLockVersion(lock, name) {
  const m = lockEntry(name).exec(lock);
  return m ? m[2] : null;
}

export function setCargoLockVersion(lock, version, name) {
  return lock.replace(lockEntry(name), `$1${version}$3`);
}

/** Problems as readable lines; empty = consistent. `crate` = our entry in Cargo.lock. */
export function checkVersions({ pkg, tauriConf, cargoToml, cargoLock }, crate) {
  const problems = [];
  const v = pkg.version;
  if (!isSemver(v)) problems.push(`package.json: "${v}" is not a semantic version`);
  if (tauriConf.version !== TAURI_VERSION_REF && tauriConf.version !== v) {
    problems.push(
      `tauri.conf.json: version "${tauriConf.version}" – expected "${TAURI_VERSION_REF}" (or "${v}")`,
    );
  }
  const ct = cargoTomlVersion(cargoToml);
  if (ct !== v) problems.push(`Cargo.toml: version "${ct}" ≠ package.json "${v}"`);
  if (cargoLock !== null) {
    const cl = cargoLockVersion(cargoLock, crate);
    if (cl !== v) problems.push(`Cargo.lock: ${crate} "${cl}" ≠ package.json "${v}"`);
  }
  return problems;
}

export function readAll(app, root = ROOT, apps = APPS) {
  const p = appPaths(app, root, apps);
  let cargoLock = null;
  try {
    cargoLock = readFileSync(p.cargoLock, 'utf8');
  } catch {
    // no lock file yet – nothing to compare
  }
  return {
    pkg: JSON.parse(readFileSync(p.pkg, 'utf8')),
    tauriConf: JSON.parse(readFileSync(p.tauriConf, 'utf8')),
    cargoToml: readFileSync(p.cargoToml, 'utf8'),
    cargoLock,
  };
}

/** Problems of every app, each line prefixed with the app; empty = all consistent. */
export function checkApps(names, root = ROOT, apps = APPS) {
  return names.flatMap((name) =>
    checkVersions(readAll(name, root, apps), appConfig(name, apps).crate).map(
      (p) => `${name}: ${p}`,
    ),
  );
}

export function setVersion(app, version, root = ROOT, apps = APPS) {
  if (!isSemver(version)) throw new Error(`"${version}" is not a semantic version`);
  const p = appPaths(app, root, apps);
  const all = readAll(app, root, apps);
  const pkgText = readFileSync(p.pkg, 'utf8');
  writeFileSync(p.pkg, pkgText.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`));
  writeFileSync(p.cargoToml, setCargoTomlVersion(all.cargoToml, version));
  if (all.cargoLock !== null) {
    writeFileSync(
      p.cargoLock,
      setCargoLockVersion(all.cargoLock, version, appConfig(app, apps).crate),
    );
  }
}

function main(argv) {
  const explicit = argv.some((a) => a === '--app' || a.startsWith('--app=')) || !!process.env.APP;
  const { app, rest } = appFromArgs(argv, process.env);
  const [cmd, arg] = rest;
  if (cmd === 'check' || cmd === undefined) {
    const names = explicit ? [app] : Object.keys(APPS);
    const problems = checkApps(names);
    if (problems.length) {
      console.error('Version mismatch:\n  ' + problems.join('\n  '));
      console.error('Fix: node scripts/version.mjs set <version> --app <app>');
      return 1;
    }
    for (const name of names) {
      console.log(
        `${name} ${readAll(name).pkg.version} – package.json, tauri.conf.json, Cargo.toml, Cargo.lock agree`,
      );
    }
    return 0;
  }
  if (cmd === 'set' && arg) {
    setVersion(app, arg);
    console.log(
      `${app}: version set to ${arg} (package.json, Cargo.toml, Cargo.lock); tauri.conf.json follows package.json`,
    );
    return 0;
  }
  console.error('usage: node scripts/version.mjs check [--app <app>] | set <x.y.z> [--app <app>]');
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}

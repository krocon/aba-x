// The apps of the monorepo (prompt 024, ADR 0007): one place for their folders, names, web base,
// Rust crate and release tags. Every script takes `--app <name>` (or `APP=<name>`), default ABA-X1.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

export const APPS = {
  'aba-x1': {
    dir: 'apps/aba-x1',
    /** Product name (tauri.conf.json `productName`, notices, release name). */
    title: 'ABA-X1',
    /** Angular project in angular.json. */
    project: 'aba-x1',
    /** Package name in Cargo.toml / Cargo.lock. */
    crate: 'aba-x',
    /** Where the web build is hosted: krocon.de/products/aba-x1/. */
    base: '/products/aba-x1/',
    /** Release tags `aba-x1-v0.2.0`; the tags before the monorepo were `v0.1.0`, `v0.1.1`. */
    tagPrefix: 'aba-x1-v',
    legacyTagPrefix: 'v',
  },
};

export const DEFAULT_APP = 'aba-x1';

/** The registry entry, or an error that names the known apps. */
export function appConfig(name, apps = APPS) {
  const app = apps[name];
  if (!app) throw new Error(`unknown app "${name}" – known: ${Object.keys(apps).join(', ')}`);
  return { name, ...app };
}

/**
 * `--app <name>` / `--app=<name>` wins over `APP=<name>`, then the default app.
 * Returns the app name and the remaining arguments.
 */
export function appFromArgs(argv, env = {}, apps = APPS) {
  const rest = [];
  let name = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--app' || a.startsWith('--app=')) {
      name = a === '--app' ? argv[++i] : a.slice('--app='.length);
      if (!name || name.startsWith('-')) throw new Error('--app needs an app name');
    } else rest.push(a);
  }
  name ??= env.APP || DEFAULT_APP;
  appConfig(name, apps); // throws for an unknown app
  return { app: name, rest };
}

/** Files of one app (absolute). */
export function appPaths(name, root = ROOT, apps = APPS) {
  const dir = join(root, appConfig(name, apps).dir);
  return {
    dir,
    pkg: join(dir, 'package.json'),
    tauriConf: join(dir, 'src-tauri', 'tauri.conf.json'),
    cargoToml: join(dir, 'src-tauri', 'Cargo.toml'),
    cargoLock: join(dir, 'src-tauri', 'Cargo.lock'),
    notices: join(dir, 'THIRD-PARTY-NOTICES.txt'),
    site: join(dir, 'site'),
    distDesktop: join(root, 'dist', name, 'desktop', 'browser'),
    distWeb: join(root, 'dist', name, 'web', 'browser'),
  };
}

/**
 * Release tag → app and version: `aba-x1-v0.2.0` → { app: 'aba-x1', version: '0.2.0' }.
 * Legacy tags (`v0.1.1`) belong to the app with that legacy prefix. `null` if no app matches.
 */
export function appFromTag(tag, apps = APPS) {
  for (const [app, c] of Object.entries(apps)) {
    if (tag.startsWith(c.tagPrefix)) return { app, version: tag.slice(c.tagPrefix.length) };
  }
  for (const [app, c] of Object.entries(apps)) {
    if (c.legacyTagPrefix && new RegExp(`^${c.legacyTagPrefix}\\d`).test(tag))
      return { app, version: tag.slice(c.legacyTagPrefix.length) };
  }
  return null;
}

// CI helper (release.yml): `node scripts/apps.mjs release <tag-or-empty> <app-input>` prints
// `app=…`, `version=…` (from apps/<app>/package.json) and `title=…`; exit 1 if the tag does not
// match the app's version.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, tag, input] = process.argv.slice(2);
  if (cmd !== 'release') {
    console.error('usage: node scripts/apps.mjs release <tag|""> <app>');
    process.exit(2);
  }
  const fromTag = tag ? appFromTag(tag) : null;
  if (tag && !fromTag) {
    console.error(`tag ${tag} names no app (expected <app>-v<version>)`);
    process.exit(1);
  }
  const app = appConfig(fromTag?.app ?? input);
  const version = JSON.parse(readFileSync(appPaths(app.name).pkg, 'utf8')).version;
  if (fromTag && fromTag.version !== version) {
    console.error(`tag ${tag} does not match ${app.dir}/package.json version ${version}`);
    process.exit(1);
  }
  console.log(`app=${app.name}\nversion=${version}\ntitle=${app.title}`);
}

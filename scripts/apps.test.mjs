import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { APPS, DEFAULT_APP, appConfig, appFromArgs, appFromTag, appPaths } from './apps.mjs';

const TWO = {
  'aba-x1': APPS['aba-x1'],
  other: {
    ...APPS['aba-x1'],
    dir: 'apps/other',
    title: 'Other',
    crate: 'other',
    base: '/products/other/',
    tagPrefix: 'other-v',
    legacyTagPrefix: null,
  },
};

test('every registered app exists with package.json, Tauri config and Angular project', () => {
  const angular = JSON.parse(readFileSync(new URL('../angular.json', import.meta.url), 'utf8'));
  for (const name of Object.keys(APPS)) {
    const p = appPaths(name);
    const app = appConfig(name);
    assert.equal(JSON.parse(readFileSync(p.pkg, 'utf8')).name, name);
    const tauri = JSON.parse(readFileSync(p.tauriConf, 'utf8'));
    assert.equal(tauri.productName, app.title);
    assert.ok(existsSync(p.cargoToml));
    const project = angular.projects[app.project];
    assert.equal(project.root, app.dir);
    assert.equal(project.architect.build.configurations.web.baseHref, app.base);
  }
});

test('app selection: --app wins over APP, then the default', () => {
  assert.deepEqual(appFromArgs(['check'], {}), { app: DEFAULT_APP, rest: ['check'] });
  assert.deepEqual(appFromArgs(['set', '1.0.0'], { APP: 'other' }, TWO), {
    app: 'other',
    rest: ['set', '1.0.0'],
  });
  assert.equal(appFromArgs(['--app', 'aba-x1'], { APP: 'other' }, TWO).app, 'aba-x1');
  assert.deepEqual(appFromArgs(['x', '--app=other', 'y'], {}, TWO), {
    app: 'other',
    rest: ['x', 'y'],
  });
});

test('an unknown app is an error that names the known ones', () => {
  assert.throws(() => appFromArgs(['--app', 'nope'], {}), /unknown app "nope" – known: aba-x1/);
  assert.throws(() => appFromArgs(['check', '--app'], {}), /--app needs an app name/);
  assert.throws(() => appFromArgs(['--app=', 'check'], {}), /--app needs an app name/);
});

test('paths per app', () => {
  const p = appPaths('other', '/r', TWO);
  assert.equal(p.cargoLock, '/r/apps/other/src-tauri/Cargo.lock');
  assert.equal(p.notices, '/r/apps/other/THIRD-PARTY-NOTICES.txt');
  assert.equal(p.distWeb, '/r/dist/other/web/browser');
});

test('release tags name app and version; the old v* tags belong to ABA-X1', () => {
  assert.deepEqual(appFromTag('aba-x1-v0.2.0'), { app: 'aba-x1', version: '0.2.0' });
  assert.deepEqual(appFromTag('v0.1.1'), { app: 'aba-x1', version: '0.1.1' });
  assert.deepEqual(appFromTag('other-v1.0.0-beta.1', TWO), {
    app: 'other',
    version: '1.0.0-beta.1',
  });
  assert.equal(appFromTag('nightly'), null);
  assert.equal(appFromTag('vnext'), null);
});

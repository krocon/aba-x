import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APPS } from './apps.mjs';
import { concernsApp, parseCommit, parseLog, renderNotes, tagPatterns } from './release-notes.mjs';

test('parses conventional headers', () => {
  assert.deepEqual(parseCommit('feat(017): app icon'), {
    type: 'feat',
    rawType: 'feat',
    scope: '017',
    subject: 'app icon',
    breaking: false,
  });
  assert.equal(parseCommit('fix!: drop old session format').breaking, true);
  assert.equal(parseCommit('refactor: x', 'BREAKING CHANGE: y').breaking, true);
  assert.equal(parseCommit('Merge whatever').type, 'other');
});

test('groups, hides chores and tests', () => {
  const md = renderNotes(
    [
      { hash: 'aaaaaaaaaa', subject: 'feat(ops): copy dialog' },
      { hash: 'bbbbbbbbbb', subject: 'fix: crash on empty dir' },
      { hash: 'cccccccccc', subject: 'chore: bump deps' },
      { hash: 'dddddddddd', subject: 'test: more cases' },
      { hash: 'eeeeeeeeee', subject: 'feat!: new config file' },
    ],
    'v0.2.0',
  );
  assert.match(md, /^## v0\.2\.0/);
  assert.match(md, /### Breaking changes\n\n- new config file \(eeeeeee\)/);
  assert.match(md, /### Features\n\n- \*\*ops:\*\* copy dialog \(aaaaaaa\)\n- new config file/);
  assert.match(md, /### Bug fixes\n\n- crash on empty dir/);
  assert.doesNotMatch(md, /bump deps|more cases/);
});

test('empty range', () => {
  assert.match(renderNotes([]), /No user-facing changes/);
});

const TWO = {
  'aba-x1': APPS['aba-x1'],
  other: { ...APPS['aba-x1'], dir: 'apps/other', tagPrefix: 'other-v', legacyTagPrefix: null },
};

test('several apps: a commit only in another app is left out, shared changes reach all', () => {
  assert.equal(concernsApp(['apps/other/src/main.ts'], 'aba-x1', TWO), false);
  assert.equal(concernsApp(['apps/other/src/main.ts'], 'other', TWO), true);
  assert.equal(concernsApp(['packages/math/src/result.ts'], 'other', TWO), true);
  assert.equal(concernsApp(['apps/aba-x1/src/main.ts', 'apps/other/x'], 'other', TWO), true);
  assert.equal(concernsApp(['pnpm-lock.yaml'], 'aba-x1', TWO), true);
  assert.equal(concernsApp([], 'other', TWO), true);
});

test('previous release: app tags, for ABA-X1 also the tags before the monorepo', () => {
  assert.deepEqual(tagPatterns('aba-x1'), ['aba-x1-v*', 'v[0-9]*']);
  assert.deepEqual(tagPatterns('other', TWO), ['other-v*']);
});

test('git log with file names', () => {
  const raw =
    '\x1eaaa\x1ffeat: one\x1f\x1f\n\napps/other/a.ts\npackages/math/b.ts\n' +
    '\x1ebbb\x1ffix: two\x1fbody\n\x1f\n\napps/aba-x1/c.ts\n';
  assert.deepEqual(parseLog(raw), [
    {
      hash: 'aaa',
      subject: 'feat: one',
      body: '',
      files: ['apps/other/a.ts', 'packages/math/b.ts'],
    },
    { hash: 'bbb', subject: 'fix: two', body: 'body', files: ['apps/aba-x1/c.ts'] },
  ]);
});

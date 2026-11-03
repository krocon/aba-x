#!/usr/bin/env node
// Release notes from Conventional Commits (adopted from Files and Folders, design 017 E4).
//
//   node scripts/release-notes.mjs [--app aba-x1] [<from-ref>] [<to-ref>]   → Markdown on stdout
//
// Default range: last tag of the app (`aba-x1-v*`, before the monorepo `v*`) .. HEAD, or the
// whole history if there is no tag yet. Merge commits are skipped. Only commits that concern the
// app (see `concernsApp`). Nothing is written or tagged.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { APPS, appConfig, appFromArgs } from './apps.mjs';

const SECTIONS = [
  ['breaking', 'Breaking changes'],
  ['feat', 'Features'],
  ['fix', 'Bug fixes'],
  ['perf', 'Performance'],
  ['docs', 'Documentation'],
  ['other', 'Other changes'],
];

const HEADER = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;

/** One commit → { type, scope, subject, breaking } (type `other` if not conventional). */
export function parseCommit(subject, body = '') {
  const m = HEADER.exec(subject.trim());
  const breakingBody = /^BREAKING[ -]CHANGE:/m.test(body);
  if (!m) return { type: 'other', scope: null, subject: subject.trim(), breaking: breakingBody };
  const type = m[1].toLowerCase();
  return {
    type: ['feat', 'fix', 'perf', 'docs'].includes(type) ? type : 'other',
    rawType: type,
    scope: m[2] ?? null,
    subject: m[4],
    breaking: m[3] === '!' || breakingBody,
  };
}

/** Markdown grouped by section; chores, tests, style and CI are left out unless breaking. */
export function renderNotes(commits, title = 'Changes') {
  const groups = new Map(SECTIONS.map(([k]) => [k, []]));
  for (const c of commits) {
    const p = parseCommit(c.subject, c.body);
    const line = `- ${p.scope ? `**${p.scope}:** ` : ''}${p.subject}${c.hash ? ` (${c.hash.slice(0, 7)})` : ''}`;
    if (p.breaking) groups.get('breaking').push(line);
    if (p.type === 'other' && ['chore', 'test', 'style', 'ci', 'build'].includes(p.rawType))
      continue;
    groups.get(p.type).push(line);
  }
  const out = [`## ${title}`, ''];
  for (const [key, heading] of SECTIONS) {
    const lines = groups.get(key);
    if (lines.length) out.push(`### ${heading}`, '', ...lines, '');
  }
  if (out.length === 2) out.push('_No user-facing changes._', '');
  return out.join('\n');
}

/**
 * A commit concerns an app unless every file it changes lies in another app's folder: changes of
 * packages/, scripts and root configuration reach every app. Without file list (empty commit) yes.
 */
export function concernsApp(files, app, apps = APPS) {
  const others = Object.keys(apps)
    .filter((n) => n !== app)
    .map((n) => `${appConfig(n, apps).dir}/`);
  if (files.length === 0) return true;
  return !files.every((f) => others.some((dir) => f.startsWith(dir)));
}

/** `git describe` patterns for the previous release of an app (new and legacy tag scheme). */
export function tagPatterns(app, apps = APPS) {
  const { tagPrefix, legacyTagPrefix } = appConfig(app, apps);
  return [`${tagPrefix}*`, ...(legacyTagPrefix ? [`${legacyTagPrefix}[0-9]*`] : [])];
}

/** Records of `git log --name-only --format=%x1e%H%x1f%s%x1f%b%x1f` → commits with files. */
export function parseLog(raw) {
  return raw
    .split('\x1e')
    .filter((r) => r.trim())
    .map((r) => {
      const [hash, subject, body, names = ''] = r.split('\x1f');
      return {
        hash: hash.trim(),
        subject,
        body: body.trim(),
        files: names
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean),
      };
    });
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function main(argv) {
  const { app, rest } = appFromArgs(argv, process.env);
  const [from, to = 'HEAD'] = rest;
  let start = from;
  if (!start) {
    try {
      const match = tagPatterns(app).flatMap((p) => ['--match', p]);
      start = git(['describe', '--tags', '--abbrev=0', ...match, to]);
    } catch {
      start = null;
    }
  }
  const range = start ? `${start}..${to}` : to;
  const raw = git(['log', '--no-merges', '--name-only', '--format=%x1e%H%x1f%s%x1f%b%x1f', range]);
  const commits = parseLog(raw).filter((c) => concernsApp(c.files, app));
  const title = appConfig(app).title;
  process.stdout.write(
    renderNotes(commits, start ? `${title} – changes since ${start}` : `${title} – changes`),
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}

// The product page (site/) stays a single static file: no scripts, no external resources,
// every picture present with its real size and an alt text.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SITE = join(fileURLToPath(new URL('.', import.meta.url)), '../apps/aba-x1/site');
const html = readFileSync(join(SITE, 'index.html'), 'utf8');

/** Width and height of a PNG from its IHDR chunk. */
function pngSize(file) {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

test('no JavaScript and no external resources', () => {
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /\son[a-z]+=/i, 'inline event handlers');
  assert.doesNotMatch(html, /@import|url\(\s*['"]?https?:/i, 'external CSS');
  for (const m of html.matchAll(/<(img|link|source|iframe|video|audio)\b[^>]*>/gi)) {
    const src = attr(m[0], 'src') ?? attr(m[0], 'href') ?? '';
    assert.doesNotMatch(src, /^(https?:)?\/\//, `external resource ${m[0]}`);
  }
});

test('every picture exists, has its real size and an alt text', () => {
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  assert.ok(imgs.length >= 5);
  for (const img of imgs) {
    const src = attr(img, 'src');
    assert.ok(attr(img, 'alt')?.length > 10, `alt text for ${src}`);
    const size = pngSize(join(SITE, src));
    assert.equal(Number(attr(img, 'width')), size.width, `width of ${src}`);
    assert.equal(Number(attr(img, 'height')), size.height, `height of ${src}`);
  }
});

test('favicon and open graph image are there', () => {
  assert.ok(readFileSync(join(SITE, attr(html.match(/<link rel="icon"[^>]*>/)[0], 'href'))));
  const og = html.match(/property="og:image" content="[^"]*\/(img\/[^"]+)"/)?.[1];
  assert.ok(og && pngSize(join(SITE, og)).width > 1000);
});

test('in-page links point to existing ids', () => {
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) {
    assert.match(html, new RegExp(`id="${id}"`), `#${id}`);
  }
});

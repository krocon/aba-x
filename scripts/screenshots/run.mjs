#!/usr/bin/env node
// Reproducible screenshots (prompt 023): renders the web build in Chromium, sets up scenes and
// writes PNGs. Needs `pnpm build:web` first (the pnpm scripts do both).
//
//   node scripts/screenshots/run.mjs            # README images (light + dark) → docs/screenshots/
//   node scripts/screenshots/run.mjs examples   # worked examples (light)       → docs/screenshots/examples/
//   node scripts/screenshots/run.mjs site       # pictures of the product page       → site/img/
//   node scripts/screenshots/run.mjs all
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { BASE, serve } from '../e2e/run.mjs';

const OUT = join(fileURLToPath(new URL('.', import.meta.url)), '../../docs/screenshots');

/** Waits until no computation is running (busy annunciator off). */
async function idle(page) {
  await page.waitForFunction(() => !document.querySelector('.ann.busy.on'), null, {
    timeout: 15000,
  });
  await page.waitForTimeout(250);
}

async function type(page, latex) {
  await page.evaluate((l) => {
    document.querySelector('math-field').value = l;
  }, latex);
}

async function enter(page, latex) {
  await type(page, latex);
  await page.click('.key[aria-label="Enter"]');
  await page.waitForTimeout(400);
  await idle(page);
}

/** Presses softkey n (1–6). */
async function soft(page, n) {
  await page.click(`.soft-cell:nth-child(${n}) .soft`);
  await page.waitForTimeout(150);
  await idle(page);
}

/** Worked examples: easy to repeat after changes (`pnpm screenshots:examples`). */
const examples = [
  {
    name: 'a-calculation',
    // 8.5 · 88 · 1.19 in the standard mode
    async setup(page) {
      await enter(page, '8.5\\cdot88\\cdot1.19');
    },
  },
  {
    name: 'b-integral',
    // ∫₀¹ sin(2x) dx: exact (with ≈), the same with →NUM, and the antiderivative from CAS ▸ CALC ▸ INTEG
    async setup(page) {
      await page.keyboard.press('F2');
      await enter(page, '\\int_0^1\\sin\\left(2x\\right)\\,dx');
      await type(page, '\\int_0^1\\sin\\left(2x\\right)\\,dx');
      await page.keyboard.press('Shift+Enter');
      await page.waitForTimeout(400);
      await idle(page);
      await type(page, '\\sin\\left(2x\\right)');
      await soft(page, 5); // CALC▸
      await soft(page, 2); // INTEG
    },
  },
  {
    name: 'c-graph',
    // y = sin((x − 1)(x + 2)), window −5 … 5 with automatic y-range, zeros marked
    async setup(page) {
      await page.keyboard.press('F3');
      await page.waitForSelector('app-graph-view canvas');
      await enter(page, '\\sin\\left(\\left(x-1\\right)\\left(x+2\\right)\\right)');
      await soft(page, 2); // ZOOM▸
      await soft(page, 1); // IN  → x −5 … 5
      await soft(page, 3); // AUTO
      await soft(page, 6); // BACK
      await soft(page, 4); // ANLYZ▸
      await soft(page, 1); // ROOT
    },
  },
];

/** Product page (site/): wide full-size shots and the device. Viewport per scene. */
const SITE = join(fileURLToPath(new URL('.', import.meta.url)), '../../site/img');

async function fullSize(page) {
  // the floating web menu button is not part of the calculator picture
  await page.addStyleTag({
    content:
      'app-menu-bar { display: none !important; } .device.full .brandline { padding-left: 0.25rem !important; }',
  });
  await page.click('.size');
  await page.waitForSelector('.device.full');
  await page.waitForTimeout(300);
}

const site = [
  {
    name: 'hero',
    viewport: { width: 1280, height: 580 },
    selector: '.device',
    async setup(page) {
      await fullSize(page);
      await page.keyboard.press('F2');
      for (const l of [
        '8.5\\cdot88\\cdot1.19',
        '\\sqrt{12}+\\frac{\\pi}{3}',
        '\\int_0^1\\sin\\left(2x\\right)\\,dx',
        '\\frac{d}{dx}\\left(x^3\\sin(x)\\right)',
        '\\sum_{k=1}^{n}k^2',
      ]) {
        await enter(page, l);
      }
      await enter(page, 'x^3-6x^2+11x-6=0');
      await soft(page, 4); // SOLVE
    },
  },
  {
    name: 'graph',
    viewport: { width: 1280, height: 580 },
    selector: '.device',
    async setup(page) {
      await fullSize(page);
      await page.keyboard.press('F3');
      await page.waitForSelector('app-graph-view canvas');
      await enter(page, '\\sin\\left(\\left(x-1\\right)\\left(x+2\\right)\\right)');
      await enter(page, '\\frac{x^2}{6}-1');
      await soft(page, 2); // ZOOM▸
      await soft(page, 1); // IN
      await soft(page, 6); // BACK
      await soft(page, 4); // ANLYZ▸
      await soft(page, 3); // ISECT
    },
  },
  {
    name: 'device-calc',
    viewport: { width: 520, height: 980 },
    selector: '.device',
    setup: (p) => examples[0].setup(p),
  },
  {
    name: 'device-cas',
    viewport: { width: 520, height: 980 },
    selector: '.device',
    setup: (p) => examples[1].setup(p),
  },
  {
    name: 'device-graph',
    viewport: { width: 520, height: 980 },
    selector: '.device',
    setup: (p) => examples[2].setup(p),
  },
];

const readme = [
  {
    name: 'standard',
    async setup(page) {
      for (const l of [
        '\\frac{1}{3}+\\frac{1}{6}',
        '\\sqrt{8}',
        '\\int_0^1x^2\\,dx',
        '\\sin(\\frac{\\pi}{6})',
      ]) {
        await enter(page, l);
      }
      await page.evaluate(() => {
        document.querySelector('math-field').value = '\\frac{d}{dx}\\left(x^3\\sin(x)\\right)';
      });
    },
  },
  {
    name: 'cas',
    async setup(page) {
      await page.keyboard.press('F2');
      await enter(page, 'x^3-6x^2+11x-6=0');
      await page.click('.soft-cell:nth-child(4) .soft');
      await page.waitForTimeout(800);
      await enter(page, '\\frac{1}{1+x^2}');
      await page.click('.soft-cell:nth-child(5) .soft');
      await page.click('.soft-cell:nth-child(2) .soft');
      await page.waitForTimeout(800);
    },
  },
  {
    name: 'graph',
    async setup(page) {
      await page.keyboard.press('F3');
      await page.waitForSelector('app-graph-view canvas');
      await enter(page, '\\tan(x)');
      await enter(page, '\\frac{x^2}{4}-2');
      await page.keyboard.press('F4');
      await page.keyboard.press('F1');
      await page.waitForTimeout(400);
    },
  },
];

async function shoot(browser, url, scene, scheme, dir) {
  const ctx = await browser.newContext({
    viewport: scene.viewport ?? { width: 520, height: 980 },
    deviceScaleFactor: 2,
    colorScheme: scheme,
    locale: 'en-US',
  });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForSelector('math-field');
  await scene.setup(page);
  await page.waitForTimeout(500);
  await mkdir(dir, { recursive: true });
  const file = join(
    dir,
    `${scene.name}${scheme === 'light' && dir !== OUT ? '' : `-${scheme}`}.png`,
  );
  await page.locator('.device').screenshot({ path: file });
  console.log(`✔ ${file}`);
  await ctx.close();
}

async function main(group = 'readme') {
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}${BASE}`;
  const browser = await chromium.launch();
  if (group === 'readme' || group === 'all') {
    for (const scheme of ['light', 'dark'])
      for (const s of readme) await shoot(browser, url, s, scheme, OUT);
  }
  if (group === 'site' || group === 'all') {
    for (const s of site) await shoot(browser, url, s, 'light', SITE);
  }
  if (group === 'examples' || group === 'all') {
    for (const s of examples) await shoot(browser, url, s, 'light', join(OUT, 'examples'));
  }
  await browser.close();
  server.close();
}

await main(process.argv[2]);

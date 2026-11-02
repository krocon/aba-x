#!/usr/bin/env node
// Reproducible screenshots for README and docs (prompt 023): renders the web build in Chromium,
// sets up a few scenes and writes PNGs to docs/screenshots/. Needs `pnpm build:web` first
// (`pnpm screenshots` does both).
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { BASE, serve } from '../e2e/run.mjs';

const OUT = join(fileURLToPath(new URL('.', import.meta.url)), '../../docs/screenshots');

async function enter(page, latex) {
  await page.evaluate((l) => {
    document.querySelector('math-field').value = l;
  }, latex);
  await page.click('.key[aria-label="Enter"]');
  await page.waitForTimeout(700);
}

const scenes = [
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

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}${BASE}`;
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    for (const scene of scenes) {
      const ctx = await browser.newContext({
        viewport: { width: 520, height: 980 },
        deviceScaleFactor: 2,
        colorScheme: scheme,
        locale: 'en-US',
      });
      const page = await ctx.newPage();
      await page.goto(url);
      await page.waitForSelector('math-field');
      await scene.setup(page);
      await page.waitForTimeout(500);
      const file = join(OUT, `${scene.name}-${scheme}.png`);
      await page.locator('.device').screenshot({ path: file });
      console.log(`✔ ${file}`);
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
}

await main();

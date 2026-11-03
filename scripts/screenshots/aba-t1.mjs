// Screenshot scenes of ABA-T1 (prompt 048), used by run.mjs --app aba-t1:
//   readme → docs/screenshots/aba-t1/ (light + dark), site → apps/aba-t1/site/img/
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const T1_OUT = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../docs/screenshots/aba-t1',
);
export const T1_SITE = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../apps/aba-t1/site/img',
);

const ROCKER = new Set(['up', 'down', 'left', 'right']);
const keys = async (page, ...ks) => {
  for (const k of ks) {
    if (ROCKER.has(k)) {
      await page.dispatchEvent(`.rk.${k}`, 'pointerdown');
      await page.dispatchEvent(`.rk.${k}`, 'pointerup');
    } else await page.click(`.key[data-key="${k}"]`);
    await page.waitForTimeout(60);
  }
};
const menu = (page, label) => page.click(`app-t1-device button.mb:text-is("${label}")`);

/** Home view entries as LaTeX (set directly, then Enter on the keypad). */
async function home(page, ...lines) {
  await keys(page, 'home');
  await page.waitForSelector('app-home-view math-field');
  for (const l of lines) {
    const before = await page.$$eval('app-home-view .history .out', (o) => o.length);
    await page.evaluate((x) => {
      document.querySelector('app-home-view math-field').value = x;
    }, l);
    await keys(page, 'enter');
    await page.waitForFunction(
      (n) => document.querySelectorAll('app-home-view .history .out').length > n,
      before,
    );
  }
}

async function startApp(page, title) {
  await keys(page, 'apps');
  await page.click(`app-library .tile:has-text("${title}")`);
  await keys(page, 'enter');
  await page.waitForTimeout(300);
}

/** Enters a definition into the open Symb row (curve apps). */
async function symb(page, selector, text) {
  await keys(page, 'enter');
  await page.click(`${selector} math-field`);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
}

export const t1Readme = [
  {
    name: 'home',
    setup: (p) =>
      home(
        p,
        '\\frac{1}{3}+\\frac{1}{6}',
        '\\sqrt{2}^{3}',
        '(1+2i)\\cdot(3-i)',
        '\\operatorname{nCr}(10,3)',
      ),
  },
  {
    name: 'cas',
    setup: async (p) => {
      await keys(p, 'cas');
      await p.waitForSelector('app-cas-view math-field');
      for (const l of [
        '\\operatorname{factor}(x^3-x)',
        '\\frac{d}{dx}\\left(x\\sin(x)\\right)',
        '\\int x e^{x}\\,dx',
        '\\operatorname{solve}(x^2-2x-3=0,x)',
      ]) {
        const before = await p.$$eval('app-cas-view .out', (o) => o.length);
        await p.evaluate((x) => {
          document.querySelector('app-cas-view math-field').value = x;
        }, l);
        await keys(p, 'enter');
        await p.waitForFunction(
          (n) => document.querySelectorAll('app-cas-view .out').length > n,
          before,
          { timeout: 20000 },
        );
      }
      await p.waitForTimeout(500);
    },
  },
  {
    name: 'function',
    setup: async (p) => {
      await startApp(p, 'Function');
      await p.waitForSelector('app-function-symb');
      await symb(p, 'app-function-symb', 'sin(X)*X');
      await keys(p, 'plot');
      await p.waitForSelector('app-function-plot canvas');
    },
  },
  {
    name: 'relation',
    setup: async (p) => {
      await startApp(p, 'Advanced Graphing');
      await keys(p, 'plot');
      await p.waitForSelector('app-relation-plot canvas');
      for (const k of [1, 6]) {
        await menu(p, 'Gallery');
        for (let i = 0; i < k; i++) await keys(p, 'down');
        await keys(p, 'enter');
        await p.waitForTimeout(600);
      }
    },
  },
  {
    name: 'statistics',
    setup: async (p) => {
      await startApp(p, 'Statistics 1Var');
      await p.waitForSelector('app-columns-editor input.line');
      await menu(p, 'More');
      await keys(p, 'down', 'down', 'enter');
      await keys(p, 'plot');
      await p.waitForSelector('app-stats-plot canvas');
    },
  },
  {
    name: 'graph3d',
    setup: async (p) => {
      await startApp(p, '3D Graphing');
      await p.waitForSelector('app-curve-symb');
      await symb(p, 'app-curve-symb', 'sin(X)*cos(Y)');
      await keys(p, 'plot');
      await p.waitForSelector('app-surface-plot canvas');
    },
  },
  {
    name: 'geometry',
    setup: async (p) => {
      await startApp(p, 'Geometry');
      await keys(p, 'symb');
      await p.waitForSelector('app-geometry-symb');
      for (const c of [
        'A = point(-3, -2)',
        'B = point(4, -2)',
        'C = point(1, 3)',
        'T = triangle(A, B, C)',
        'K = circumcircle(A, B, C)',
        'M = midpoint(A, B)',
      ]) {
        await p.click('app-t1-device .mb:nth-child(3)');
        await p.waitForSelector('#geo-symb-entry');
        await p.fill('#geo-symb-entry', c);
        await p.press('#geo-symb-entry', 'Enter');
        await p.waitForTimeout(150);
      }
      await keys(p, 'plot');
      await p.waitForTimeout(400);
    },
  },
  {
    name: 'program',
    setup: async (p) => {
      await keys(p, 'shift', 'd1');
      await p.waitForSelector('app-program-catalog');
      await menu(p, 'New');
      await p.fill('app-program-catalog .ask input', 'COLLATZ');
      await p.press('app-program-catalog .ask input', 'Enter');
      await p.waitForSelector('app-program-editor textarea');
      await p.fill(
        'app-program-editor textarea',
        [
          'EXPORT COLLATZ(n)',
          'BEGIN',
          '  LOCAL steps := 0;',
          '  WHILE n ≠ 1 DO',
          '    IF n MOD 2 == 0 THEN',
          '      n := n / 2;',
          '    ELSE',
          '      n := 3 * n + 1;',
          '    END;',
          '    steps := steps + 1;',
          '  END;',
          '  RETURN steps;',
          'END;',
        ].join('\n'),
      );
      await p.waitForTimeout(300);
    },
  },
  {
    name: 'python',
    setup: async (p) => {
      await startApp(p, 'Python');
      const line = 'app-python-shell .line input';
      await p.waitForSelector(line);
      for (const c of ['import math', 'sum(range(10))', '[k*k for k in range(8)]', 'math.pi']) {
        await p.fill(line, c);
        await p.press(line, 'Enter');
        await p.waitForTimeout(700);
      }
    },
  },
];

/** Product page: the same scenes, plus a wide page shot for link previews. */
export const t1Site = [
  ...t1Readme.map((s) => ({ ...s, viewport: { width: 520, height: 980 } })),
  {
    name: 'og',
    page: true,
    viewport: { width: 1200, height: 630 },
    setup: (p) => t1Readme.find((s) => s.name === 'function').setup(p),
  },
];

#!/usr/bin/env node
// End-to-end checks of the web build in real browsers (prompts 020/021): calculation, CAS, graph,
// real typing on the hardware keyboard, offline via the service worker, phone width, axe
// accessibility scan, start-up time. Needs `pnpm build:web` first (`pnpm e2e` does both).
//
//   node scripts/e2e/run.mjs                 # chromium, webkit, firefox
//   E2E_BROWSERS=chromium node scripts/e2e/run.mjs
//   node scripts/e2e/run.mjs --serve 4300    # local preview of the web build, as hosted
//   node scripts/e2e/run.mjs --build         # builds the web build of the app first (`pnpm e2e`)
// `--app <name>` / `APP=<name>` picks the app (scripts/apps.mjs); scenarios: ABA-X1 here,
// ABA-T1 in scripts/e2e/aba-t1.mjs.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { DEFAULT_APP, appConfig, appFromArgs, appPaths } from '../apps.mjs';
import { t1Scenarios } from './aba-t1.mjs';

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** Web build and hosting path of an app (angular.json `web`: krocon.de/products/<app>/). */
export function webBuild(app = DEFAULT_APP) {
  return { root: appPaths(app).distWeb, base: appConfig(app).base };
}

/** Serves the build under its base only – like the real server, so wrong absolute paths show up as 404. */
export function serve(root = webBuild().root, base = webBuild().base) {
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!url.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    const path = normalize(url.slice(base.length - 1)).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, path === '/' ? 'index.html' : path);
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const axeSource = await readFile(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);

async function levels(page) {
  return page.$$eval('.level .main', (els) => els.map((e) => e.textContent.trim()));
}

async function enterLatex(page, latex) {
  await page.evaluate((l) => {
    document.querySelector('math-field').value = l;
  }, latex);
  await page.click('.key[aria-label="Enter"]');
}

async function waitLevel1(page, expected) {
  await page.waitForFunction(
    (e) => [...document.querySelectorAll('.level .main')].at(-1)?.textContent.trim() === e,
    expected,
    { timeout: 15000 },
  );
}

const checks = {
  async loads(page) {
    await page.waitForSelector('math-field', { timeout: 20000 });
    const title = await page.title();
    if (!title.startsWith('ABA-X1')) throw new Error(`title ${title}`);
  },
  async calculates(page) {
    await enterLatex(page, '\\frac{1}{3}+\\frac{1}{6}');
    await waitLevel1(page, '\\frac{1}{2}');
    await enterLatex(page, '\\sqrt{8}');
    await waitLevel1(page, '2\\sqrt{2}');
  },
  async hardwareKeyboard(page) {
    await page.click('math-field');
    await page.keyboard.type('2+3*4');
    await page.keyboard.press('Enter');
    await waitLevel1(page, '14');
  },
  /** What is drawn, not just the text: stack rows are reused, the formula must be re-rendered. */
  async renderedStack(page) {
    const drawn = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.level .main math-span')].map(
          (m) => m.shadowRoot?.textContent?.replace(/\s+/g, '') ?? '',
        ),
      );
    const before = await drawn();
    await page.click('.key[aria-label="Enter"]'); // duplicate level 1 → every row shifts
    await page.waitForTimeout(400);
    const after = await drawn();
    if (
      !after.at(-1)?.includes('14') ||
      !after.at(-2)?.includes('14') ||
      JSON.stringify(before) === JSON.stringify(after)
    ) {
      throw new Error(`stack not re-rendered: ${JSON.stringify(after)}`);
    }
  },
  async cas(page) {
    await page.keyboard.press('F2');
    await enterLatex(page, 'x^2-4=0');
    await page.waitForFunction(
      () => document.querySelectorAll('.menu-label')[3]?.textContent.trim() === 'SOLVE',
    );
    await page.click('.soft-cell:nth-child(4) .soft');
    await waitLevel1(page, String.raw`x=-2,\;x=2`);
    await page.keyboard.press('F6');
    await page.keyboard.press('F1');
  },
  async graph(page) {
    await page.keyboard.press('F3');
    await page.waitForSelector('app-graph-view canvas');
    await enterLatex(page, 'x^2-4');
    await page.keyboard.press('F4');
    await page.keyboard.press('F1');
    await page.waitForFunction(
      () => document.querySelector('.msg').textContent.includes('x = -2, x = 2'),
      null,
      {
        timeout: 10000,
      },
    );
    await page.keyboard.press('F6');
    await page.keyboard.press('F6');
    await page.keyboard.press('F1');
  },
  async phoneWidth(page) {
    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    await page.setViewportSize({ width: 1000, height: 900 });
    if (overflow > 0) throw new Error(`horizontal overflow ${overflow}px at 375px`);
  },
  /** Full size (⌥F): fills the window without scrolling, more stack levels in a big display. */
  async fullSize(page) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.click('math-field');
    await page.keyboard.press('Alt+KeyF');
    await page.waitForSelector('.device.full');
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      levels: document.querySelectorAll('.level').length,
      overflow:
        document.documentElement.scrollHeight -
        innerHeight +
        (document.documentElement.scrollWidth - innerWidth),
    }));
    await page.setViewportSize({ width: 375, height: 812 });
    const phone = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await page.keyboard.press('Alt+KeyF');
    await page.waitForFunction(() => !document.querySelector('.device.full'));
    await page.setViewportSize({ width: 1000, height: 900 });
    if (r.levels <= 4 || r.overflow > 0 || phone > 0)
      throw new Error(`full size: ${JSON.stringify({ ...r, phone })}`);
  },
  async accessibility(page) {
    await page.addScriptTag({ content: axeSource });
    const r = await page.evaluate(() =>
      // eslint-disable-next-line no-undef
      axe.run(document, { resultTypes: ['violations'] }),
    );
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    if (bad.length) {
      throw new Error(
        bad
          .map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes[0]?.target}`)
          .join('; '),
      );
    }
    return r.violations.map((v) => `${v.id}:${v.impact}`);
  },
};

async function offline(browser, url) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url);
  await page
    .waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30000 })
    .catch(async () => {
      await page.reload();
      await page.waitForFunction(() => navigator.serviceWorker?.controller, null, {
        timeout: 30000,
      });
    });
  // let the prefetch of the asset groups finish
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('math-field', { timeout: 20000 });
  await enterLatex(page, '\\frac{d}{dx}x^3');
  await waitLevel1(page, '3x^{2}');
  await ctx.close();
}

/** Scenarios per app: the checks (in order), the offline check and a label of the page state. */
function scenarios(app) {
  if (app === 'aba-t1') return t1Scenarios({ axeSource });
  if (app === 'aba-x1') return { checks, offline, state: x1State };
  return null;
}

function x1State() {
  return {
    path: document.querySelector('.path')?.textContent,
    menu: [...document.querySelectorAll('.menu-label')].map((x) => x.textContent.trim()).join(' '),
    levels: [...document.querySelectorAll('.level .main')].map((x) => x.textContent.trim()),
    msg: document.querySelector('.msg')?.textContent.trim(),
  };
}

async function main({ root, base }, { checks, offline, state }) {
  const server = await serve(root, base);
  const url = `http://127.0.0.1:${server.address().port}${base}`;
  const wanted = (process.env.E2E_BROWSERS ?? 'chromium,webkit,firefox').split(',');
  const engines = { chromium, webkit, firefox };
  let failed = 0;
  for (const name of wanted) {
    let browser;
    try {
      browser = await engines[name].launch({ timeout: 60000 });
    } catch (e) {
      console.log(`– ${name} not available here: ${e.message.split('\n')[0]}`);
      continue;
    }
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // every request must stay below the base path (krocon.de/products/aba-x1/)
    page.on('response', (r) => {
      if (r.status() === 404) errors.push(`404 ${new URL(r.url()).pathname}`);
    });
    const t0 = Date.now();
    await page.goto(url);
    for (const [check, run] of Object.entries(checks)) {
      try {
        const info = await run(page);
        const extra =
          check === 'loads'
            ? ` (${Date.now() - t0} ms to the input line)`
            : info?.length
              ? ` minor: ${info.join(', ')}`
              : '';
        console.log(`✔ ${name} ${check}${extra}`);
      } catch (e) {
        failed++;
        const pageState = await page.evaluate(state).catch(() => null);
        console.log(
          `✘ ${name} ${check}: ${e.message.split('\n')[0]}\n    state: ${JSON.stringify(pageState)}`,
        );
      }
    }
    if (name === 'chromium') {
      try {
        await offline(browser, url);
        console.log(`✔ ${name} offline (service worker)`);
      } catch (e) {
        failed++;
        console.log(`✘ ${name} offline: ${e.message.split('\n')[0]}`);
      }
    }
    if (errors.length) {
      failed++;
      console.log(`✘ ${name} page errors: ${errors.join(' | ')}`);
    }
    await browser.close();
  }
  server.close();
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { app, rest: args } = appFromArgs(process.argv.slice(2), process.env);
  const rest = args.filter((a) => a !== '--build');
  if (args.includes('--build')) {
    execFileSync(
      'pnpm',
      ['exec', 'ng', 'build', appConfig(app).project, '--configuration', 'web'],
      {
        stdio: 'inherit',
      },
    );
  }
  const { root, base } = webBuild(app);
  if (rest[0] === '--serve') {
    // local preview exactly as hosted: http://localhost:<port>/products/<app>/
    const port = Number(rest[1] ?? 4300);
    const server = await serve(root, base);
    server.close();
    createServer((req, res) => server.emit('request', req, res)).listen(port, () =>
      console.log(`web build of ${app} at http://localhost:${port}${base}`),
    );
  } else if (!scenarios(app)) {
    console.error(`no end-to-end scenarios for ${app} yet (scripts/e2e/run.mjs)`);
    process.exitCode = 1;
  } else {
    await main({ root, base }, scenarios(app));
  }
}

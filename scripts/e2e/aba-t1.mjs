// End-to-end scenarios of ABA-T1 (prompt 025 ff.), run by scripts/e2e/run.mjs --app aba-t1.
// Each prompt adds its checks here; the runner reports them per browser.

async function lastResult(page, want) {
  await page.waitForFunction(
    (w) =>
      [...document.querySelectorAll('app-home-view .history .out')]
        .at(-1)
        ?.getAttribute('data-value') === w,
    want,
    { timeout: 15000 },
  );
}

/** @param {{ axeSource: string }} deps */
export function t1Scenarios({ axeSource }) {
  const checks = {
    async loads(page) {
      await page.waitForSelector('app-t1-device .lcd', { timeout: 20000 });
      const title = await page.title();
      if (!title.startsWith('ABA-T1')) throw new Error(`title ${title}`);
    },
    async homeCalculates(page) {
      await page.waitForSelector('app-home-view math-field', { timeout: 20000 });
      for (const k of ['d2', 'add', 'd3', 'mul', 'd4', 'enter'])
        await page.click(`.key[data-key="${k}"]`);
      await lastResult(page, '14');
      for (const k of ['shift', 'sq', 'd8', 'd1', 'enter'])
        await page.click(`.key[data-key="${k}"]`);
      await lastResult(page, '9');
    },
    async hardwareKeyboard(page) {
      await page.click('app-home-view math-field');
      await page.keyboard.type('7*6');
      await page.keyboard.press('Enter');
      await lastResult(page, '42');
    },
    async rpn(page) {
      const setEntry = async (v) => {
        await page.click('.key[data-key="shift"]');
        await page.click('.key[data-key="home"]');
        await page.selectOption('#set-entry', v);
        await page.click('app-t1-device .mb:nth-child(6)');
      };
      await setEntry('rpn');
      await page.waitForSelector('app-rpn-view math-field', { timeout: 20000 });
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      const level1 = (want) =>
        page.waitForFunction(
          (w) =>
            [...document.querySelectorAll('app-rpn-view .val')]
              .at(-1)
              ?.getAttribute('data-value') === w,
          want,
          { timeout: 15000 },
        );
      await keys('d3', 'enter', 'd4', 'add');
      await level1('7');
      await keys('d2', 'enter', 'd3', 'pow');
      await level1('8');
      await page.click('app-t1-device .mb:nth-child(2)'); // SWAP
      await level1('7');
      await keys('bksp', 'bksp');
      await page.waitForFunction(() => document.querySelectorAll('app-rpn-view .val').length === 0);
      await setEntry('textbook');
      await page.waitForSelector('app-home-view math-field', { timeout: 20000 });
    },
    async cas(page) {
      await page.click('.key[data-key="cas"]');
      await page.waitForSelector('app-cas-view math-field', { timeout: 20000 });
      await page.click('app-cas-view math-field');
      await page.keyboard.type('solve(x^2=4,x)');
      await page.keyboard.press('Enter');
      const last = (want) =>
        page.waitForFunction(
          (w) =>
            [...document.querySelectorAll('app-cas-view .out')]
              .at(-1)
              ?.getAttribute('data-value') === w,
          want,
          { timeout: 20000 },
        );
      await last('x=-2, x=2');
      await page.keyboard.type('ifactor(360)');
      await page.keyboard.press('Enter');
      await last('2^3*3^2*5');
      await page.click('.key[data-key="home"]');
      await page.waitForSelector('app-home-view math-field', { timeout: 20000 });
    },
    async toolbox(page) {
      await page.click('.key[data-key="toolbox"]');
      await page.waitForSelector('app-popup li');
      // rocker ↓, Enter: Math › Arithmetic; Enter: gcd (first entry)
      await page.dispatchEvent('.rk.down', 'pointerdown');
      await page.dispatchEvent('.rk.down', 'pointerup');
      await page.click('.key[data-key="enter"]');
      await page.waitForSelector('app-popup li:first-child .name:text-is("gcd")');
      await page.click('.key[data-key="enter"]');
      await page.waitForFunction(() => !document.querySelector('app-popup'));
      await page.keyboard.type('12,18');
      await page.keyboard.press('Enter');
      await lastResult(page, '6');
      await page.click('.key[data-key="help"]');
      await page.waitForSelector('app-popup .help');
      await page.click('.key[data-key="esc"]');
      await page.click('.key[data-key="vars"]');
      await page.waitForSelector('app-popup li:has-text("Ans")');
      await page.click('.key[data-key="esc"]');
      await page.waitForFunction(() => !document.querySelector('app-popup'));
    },
    async unitsAndBases(page) {
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      await keys('d3', 'shift', 'template'); // Units menu
      await page.waitForSelector('app-popup li');
      await keys('enter', 'd4'); // Length › km
      await page.waitForFunction(() => !document.querySelector('app-popup'));
      await keys('enter');
      await lastResult(page, '3 km');
      await page.click('app-home-view math-field');
      await page.keyboard.type('#FFh+1');
      await page.keyboard.press('Enter');
      await lastResult(page, '#100h');
    },
    async keypad(page) {
      const r = await page.$$eval('app-t1-device .key', (keys) => ({
        count: keys.length,
        unnamed: keys.filter((k) => !k.getAttribute('aria-label')).length,
      }));
      if (r.count < 47 || r.unnamed) throw new Error(`keys ${JSON.stringify(r)}`);
    },
    async displayKeepsSize(page) {
      const h = () => page.$eval('app-t1-device .lcd', (e) => e.getBoundingClientRect().height);
      const before = await h();
      for (let i = 0; i < 8; i++) {
        await page.click('.key[data-key="d7"]');
        await page.click('.key[data-key="enter"]');
      }
      if (Math.abs((await h()) - before) > 0.5) throw new Error('display changed its size');
    },
    async shiftAlpha(page) {
      const ann = () => page.$eval('app-t1-device .ann', (e) => e.textContent.trim());
      await page.click('.key[data-key="shift"]');
      await page.waitForFunction(() =>
        document.querySelector('app-t1-device .ann').textContent.includes('⇧'),
      );
      await page.click('.key[data-key="shift"]');
      await page.click('.key[data-key="alpha"]');
      await page.click('.key[data-key="alpha"]');
      await page.waitForFunction(() =>
        document.querySelector('app-t1-device .ann').textContent.includes('🔒'),
      );
      await page.click('.key[data-key="alpha"]');
      const mods = ['⇧', 'A', 'a', 'A🔒', 'a🔒'];
      await page.waitForFunction(
        (m) =>
          ![...document.querySelectorAll('app-t1-device .ann span')].some((s) =>
            m.includes(s.textContent.trim()),
          ),
        mods,
      );
      if (/[⇧🔒]/u.test(await ann())) throw new Error(`annunciators ${await ann()}`);
    },
    async phoneWidth(page) {
      await page.setViewportSize({ width: 375, height: 812 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      await page.setViewportSize({ width: 1000, height: 900 });
      if (overflow > 0) throw new Error(`horizontal overflow ${overflow}px at 375px`);
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
    await page.waitForTimeout(1500);
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('app-home-view math-field', { timeout: 20000 });
    for (const k of ['d1', 'add', 'd1', 'enter']) await page.click(`.key[data-key="${k}"]`);
    await lastResult(page, '2');
    await ctx.close();
  }

  function state() {
    return {
      title: document.querySelector('app-t1-device .title')?.textContent?.trim(),
      line: document.querySelector('math-field')?.value,
      rows: [...document.querySelectorAll('.history li')].map((li) =>
        li.textContent.trim().slice(0, 60),
      ),
      menu: [...document.querySelectorAll('app-t1-device .mb')]
        .map((b) => b.textContent.trim())
        .join('|'),
    };
  }

  return { checks, offline, state };
}

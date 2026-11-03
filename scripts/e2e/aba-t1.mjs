// End-to-end scenarios of ABA-T1 (prompt 025 ff.), run by scripts/e2e/run.mjs --app aba-t1.
// Each prompt adds its checks here; the runner reports them per browser.

/** @param {{ axeSource: string }} deps */
export function t1Scenarios({ axeSource }) {
  const checks = {
    async loads(page) {
      await page.waitForSelector('app-t1-device .lcd', { timeout: 20000 });
      const title = await page.title();
      if (!title.startsWith('ABA-T1')) throw new Error(`title ${title}`);
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
      await page.click('.key[data-key="d7"]');
      await page.click('.key[data-key="enter"]');
      if (Math.abs((await h()) - before) > 0.5) throw new Error('display changed its size');
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
    await page.waitForSelector('app-t1-device .lcd', { timeout: 20000 });
    await ctx.close();
  }

  function state() {
    return {
      title: document.querySelector('app-t1-device .title')?.textContent?.trim(),
      menu: [...document.querySelectorAll('app-t1-device .mb')]
        .map((b) => b.textContent.trim())
        .join('|'),
    };
  }

  return { checks, offline, state };
}

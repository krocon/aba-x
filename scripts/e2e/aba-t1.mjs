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

import { readFile } from 'node:fs/promises';

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
    async listsAndMatrices(page) {
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      const rocker = async (d) => {
        await page.dispatchEvent(`.rk.${d}`, 'pointerdown');
        await page.dispatchEvent(`.rk.${d}`, 'pointerup');
      };
      const ok = () => page.click('app-t1-device .mb:nth-child(6)');
      // L0 = {1, 2, 3} in the list editor
      await keys('shift', 'd7');
      await page.waitForSelector('app-data-catalog');
      await keys('d0', 'enter');
      await page.waitForSelector('app-grid-editor');
      await keys('d1', 'enter', 'd2', 'enter', 'd3', 'enter');
      await ok();
      await ok();
      await page.waitForSelector('app-home-view math-field');
      await page.click('app-home-view math-field');
      await page.keyboard.type('sumlist(L0)');
      await page.keyboard.press('Enter');
      await lastResult(page, '6');
      // M1 = [[1, 2], [3, 4]] in the matrix editor
      await keys('shift', 'd4');
      await page.waitForSelector('app-data-catalog');
      await keys('d1', 'enter');
      await page.waitForSelector('app-grid-editor');
      await keys('d1', 'enter', 'd2', 'enter');
      await rocker('down');
      await rocker('left');
      await rocker('left');
      await keys('d3', 'enter', 'd4', 'enter');
      await ok();
      await ok();
      await page.waitForSelector('app-home-view math-field');
      await page.click('app-home-view math-field');
      await page.keyboard.type('det(M1)');
      await page.keyboard.press('Enter');
      await lastResult(page, '-2');
    },
    async apps(page) {
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      await keys('apps');
      await page.waitForSelector('app-library .tile');
      await keys('enter'); // Function
      await page.waitForSelector('app-function-symb');
      await keys('enter'); // edit F1
      await page.waitForSelector('app-function-symb math-field');
      await page.click('app-function-symb math-field');
      await page.keyboard.type('X^2-4');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() =>
        document.querySelector('app-function-symb .def')?.textContent.includes('X'),
      );
      await keys('num');
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('app-function-num tbody tr')][2]?.textContent.replace(
            /\s+/g,
            '',
          ) === '20',
      );
      await keys('plot');
      await page.waitForSelector('app-function-plot canvas');
      await page.click('app-t1-device .mb:nth-child(4)'); // Fcn
      await page.waitForSelector('app-plot-menu li');
      await keys('enter'); // Root
      await page.waitForFunction(() =>
        /X=-?2\b/.test(document.querySelector('app-function-plot .bar')?.textContent ?? ''),
      );
      await keys('home');
      await page.waitForSelector('app-home-view math-field');
    },
    async curveApps(page) {
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      await keys('apps');
      const tile = 'app-library .tile:has-text("Parametric")';
      await page.click(tile);
      await keys('enter');
      await page.waitForSelector('app-curve-symb');
      await keys('enter');
      await page.click('app-curve-symb math-field');
      await page.keyboard.type('T^2');
      await page.keyboard.press('Enter'); // X1, moves to Y1
      await keys('enter');
      await page.waitForSelector('app-curve-symb math-field');
      await page.click('app-curve-symb math-field');
      await page.keyboard.type('T+1');
      await page.keyboard.press('Enter');
      await keys('num');
      // T = 0.3 (row 4): X = 0.09, Y = 1.3
      await page.waitForFunction(
        () =>
          [...([...document.querySelectorAll('app-curve-num tbody tr')][3]?.children ?? [])]
            .map((c) => c.textContent.trim())
            .join('|') === '0.3|0.09|1.3',
      );
      await keys('plot');
      await page.waitForSelector('app-curve-plot canvas');
      await keys('home');
      await page.waitForSelector('app-home-view math-field');
    },
    async notesAndBackup(page) {
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      const menuItem = async (menu, item) => {
        await page.click(`app-web-menu .top:has-text("${menu}")`);
        await page.click(`app-web-menu [role="menuitem"]:has-text("${item}")`);
      };
      // a note
      await keys('shift', 'd0');
      await page.waitForSelector('app-notes-view');
      await page.click('app-t1-device .mb:nth-child(1)'); // New
      await page.fill('app-notes-view textarea', '# Backup test\nsome $x^2$');
      await keys('esc');
      // export the backup (a download on the web)
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        menuItem('File', 'Export backup'),
      ]);
      const path = await download.path();
      const text = await readFile(path, 'utf8');
      const json = JSON.parse(text);
      if (json.format !== 'aba-t1-backup' || !json.docs.notes)
        throw new Error('backup without notes');
      // delete the notes, then import the backup again
      await keys('shift', 'toolbox');
      await page.waitForSelector('app-memory-view');
      await page.click('app-memory-view tr:has-text("Notes")');
      await page.click('app-t1-device .mb:nth-child(1)'); // Clear
      await page.click('app-t1-device .mb:nth-child(6)'); // Yes
      await page.waitForFunction(() =>
        [...document.querySelectorAll('app-memory-view tr')].some((r) =>
          /^Notes\s*0/.test(r.textContent.trim()),
        ),
      );
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        menuItem('File', 'Import backup'),
      ]);
      await chooser.setFiles(path);
      await page.click('app-modal .btn.primary');
      await keys('shift', 'd0');
      await page.waitForSelector('app-notes-view li:has-text("Backup test")');
      await keys('home');
      await page.waitForSelector('app-home-view math-field');
    },
    async explorer(page) {
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      await keys('apps');
      await page.click('app-library .tile:has-text("Quadratic Explorer")');
      await keys('enter');
      await page.waitForSelector('app-explorer-view canvas');
      // a = 1 → 1.5 with ↑ on the selected parameter a
      await page.dispatchEvent('.rk.up', 'pointerdown');
      await page.dispatchEvent('.rk.up', 'pointerup');
      await page.waitForFunction(() =>
        document.querySelector('app-explorer-view .det')?.textContent.includes('1.5x²'),
      );
      await keys('home');
      await page.waitForSelector('app-home-view math-field');
    },
    async graph3d(page) {
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      await keys('apps');
      await page.click('app-library .tile:has-text("3D Graphing")');
      await keys('enter');
      await page.waitForSelector('app-curve-symb');
      await keys('enter');
      await page.click('app-curve-symb math-field');
      await page.keyboard.type('X*Y');
      await page.keyboard.press('Enter');
      await keys('plot');
      await page.waitForSelector('app-surface-plot canvas');
      await keys('num');
      // first grid point X = −5, Y = −5 → 25
      await page.waitForFunction(
        () =>
          [...([...document.querySelectorAll('app-surface-num tbody tr')][0]?.children ?? [])]
            .map((c) => c.textContent.trim())
            .join('|') === '-5|-5|25',
      );
      await keys('home');
      await page.waitForSelector('app-home-view math-field');
    },
    async relation(page) {
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      await keys('apps');
      await page.click('app-library .tile:has-text("Advanced Graphing")');
      await keys('enter');
      await page.waitForSelector('app-curve-symb');
      await keys('enter');
      await page.click('app-curve-symb math-field');
      await page.keyboard.type('X*X+Y*Y<9');
      await page.keyboard.press('Enter');
      await keys('plot');
      await page.waitForSelector('app-relation-plot canvas');
      await keys('num');
      // X = 0 (sixth row from −5): the boundary of the disc at Y = ±3
      await page.waitForFunction(
        () =>
          [...([...document.querySelectorAll('app-relation-num tbody tr')][5]?.children ?? [])]
            .map((c) => c.textContent.trim())
            .join('|') === '0|-3; 3',
      );
      await keys('home');
      await page.waitForSelector('app-home-view math-field');
    },
    async statistics(page) {
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      const menu = (label) => page.click(`app-t1-device button.mb:text-is("${label}")`);
      const enter = async (...vs) => {
        for (const v of vs) {
          await page.keyboard.type(String(v));
          await page.keyboard.press('Enter');
        }
      };
      // 1 Var: D1 = 1…5, statistics and the histogram
      await keys('apps');
      await page.click('app-library .tile:has-text("Statistics 1Var")');
      await keys('enter');
      await page.waitForSelector('app-columns-editor input.line');
      await page.click('app-columns-editor input.line');
      await enter(1, 2, 3, 4, 5);
      await menu('Stats');
      await page.waitForFunction(() =>
        [...document.querySelectorAll('app-stats-num .stats tbody tr')].some(
          (r) => r.textContent.replace(/\s+/g, '') === 'x̄3',
        ),
      );
      await keys('esc', 'plot');
      await page.waitForSelector('app-stats-plot canvas');
      // 2 Var: C1 = 1…4, C2 = 3, 5, 7, 9 → linear fit, Pred Y at 10 = 21
      await keys('apps');
      await page.click('app-library .tile:has-text("Statistics 2Var")');
      await keys('enter');
      await page.waitForSelector('app-columns-editor input.line');
      await page.click('app-columns-editor input.line');
      await enter(1, 2, 3, 4);
      await page.keyboard.press('ArrowRight');
      for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
      await enter(3, 5, 7, 9);
      await keys('plot');
      await page.waitForSelector('app-stats-plot canvas');
      await menu('Pred Y');
      await page.fill('app-stats-plot .bar input', '10');
      await page.press('app-stats-plot .bar input', 'Enter');
      await page.waitForFunction(() =>
        document.querySelector('app-stats-plot .bar')?.textContent.includes('Y: 21'),
      );
      await keys('home');
      await page.waitForSelector('app-home-view math-field');
    },
    async inference(page) {
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      // normal distribution in the home view
      await keys('home');
      await page.click('app-home-view math-field');
      await page.keyboard.type('normalcdf(1.96)');
      await page.keyboard.press('Enter');
      await lastResult(page, '0.975002104852');
      // T test with D1 = 1…5 of Statistics 1Var imported: T = 4.2426, P = 0.0132
      await keys('apps');
      await page.click('app-library .tile:has-text("Inference")');
      await keys('enter', 'num');
      await page.waitForSelector('app-inference-num');
      await page.click('app-t1-device button.mb:text-is("Import")');
      await keys('enter');
      await page.waitForFunction(() =>
        [...document.querySelectorAll('app-inference-num .results tr')].some((r) =>
          r.textContent.replace(/\s+/g, '').startsWith('P0.0132'),
        ),
      );
      await keys('plot');
      await page.waitForSelector('app-inference-plot canvas');
      await keys('home');
      await page.waitForSelector('app-home-view math-field');
    },
    async spreadsheet(page) {
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      const cell = (key) => {
        const col = key.charCodeAt(0) - 65;
        const row = Number(key.slice(1)) - 1;
        return `app-sheet-num .cell[data-r="${row}"][data-c="${col}"]`;
      };
      const cellIs = (key, want) =>
        page.waitForFunction(
          ([sel, w]) => document.querySelector(sel)?.textContent.trim() === w,
          [cell(key), want],
          { timeout: 10000 },
        );
      await keys('apps');
      await page.click('app-library .tile:has-text("Spreadsheet")');
      await keys('enter');
      await page.waitForSelector('app-sheet-num .line');
      // device keys: 2 Enter 3 Enter, then a formula typed on the PC keyboard
      await keys('d2', 'enter', 'd3', 'enter');
      await page.click('app-sheet-num .line');
      await page.keyboard.type('=A1+A2');
      await page.keyboard.press('Enter');
      await cellIs('A3', '5');
      // B1 = A1*10, filled down to B3 (relative references move)
      await page.click(cell('B1'));
      await page.keyboard.type('=A1*10');
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Shift+ArrowDown');
      await page.keyboard.press('Shift+ArrowDown');
      await page.click('app-t1-device .mb:nth-child(6)');
      await page.click('app-plot-menu li:has-text("Fill down")');
      await cellIs('B3', '50');
      // a cycle is an error value, never a hang
      await page.click(cell('C1'));
      await page.keyboard.type('=C2');
      await page.keyboard.press('Enter');
      await page.keyboard.type('=C1');
      await page.keyboard.press('Enter');
      await cellIs('C1', '#CYCLE!');
      // name A3 "T" and use it in Home
      await page.click(cell('A3'));
      await page.keyboard.type('T');
      await page.click('app-t1-device .mb:nth-child(3)');
      await page.waitForFunction(() =>
        document.querySelector('app-sheet-num .status')?.textContent.includes('T = $A$3'),
      );
      await page.addScriptTag({ content: axeSource });
      const r = await page.evaluate(() =>
        // eslint-disable-next-line no-undef
        axe.run(document.querySelector('app-sheet-num'), { resultTypes: ['violations'] }),
      );
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      if (bad.length) throw new Error(bad.map((v) => `${v.id}: ${v.nodes[0]?.target}`).join('; '));
      await keys('home');
      await page.click('app-home-view math-field');
      await page.keyboard.type('T*2');
      await page.keyboard.press('Enter');
      await lastResult(page, '10');
    },
    async geometry(page) {
      const keys = async (...ks) => {
        for (const k of ks) await page.click(`.key[data-key="${k}"]`);
      };
      const menu = (i) => page.click(`app-t1-device .mb:nth-child(${i})`);
      await keys('apps');
      await page.click('app-library .tile:has-text("Geometry")');
      await keys('enter');
      await page.waitForSelector('app-geometry-plot canvas');
      // Symb: a triangle and its circumcircle as commands
      await keys('symb');
      await page.waitForSelector('app-geometry-symb');
      for (const cmd of [
        'A = point(0, 0)',
        'B = point(4, 0)',
        'C = point(0, 3)',
        't = triangle(A, B, C)',
        'u = circumcircle(A, B, C)',
      ]) {
        await menu(3); // New
        await page.waitForSelector('#geo-symb-entry');
        await page.fill('#geo-symb-entry', cmd);
        await page.press('#geo-symb-entry', 'Enter');
        await page.waitForSelector(`app-geometry-symb li:has-text("${cmd.split(' = ')[1]}")`);
      }
      // Num: area and angle
      await keys('num');
      await page.waitForSelector('app-geometry-num');
      for (const m of ['area(t)', 'angle(B, A, C)', 'radius(u)']) {
        await menu(2); // New
        await page.waitForSelector('#geo-num-entry');
        await page.fill('#geo-num-entry', m);
        await page.press('#geo-num-entry', 'Enter');
      }
      const cells = () =>
        page.$$eval('app-geometry-num tbody tr', (rows) =>
          rows.map((r) => [...r.children].map((c) => c.textContent.trim()).join('|')),
        );
      await page.waitForFunction(
        () => document.querySelectorAll('app-geometry-num tbody tr').length === 3,
      );
      const before = await cells();
      if (before[0] !== 'area(t)|6' || before[2] !== 'radius(u)|2.5')
        throw new Error(`measurements ${JSON.stringify(before)}`);
      // Plot: drag C from (0, 3) up to about (0, 6) – area and radius follow
      await keys('plot');
      await page.waitForSelector('app-geometry-plot canvas');
      const box = await page.$eval('app-geometry-plot canvas', (c) => {
        const r = c.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      });
      // standard window: x −10 … 10, equal units, centre (0, 0)
      const px = (x, y) => ({
        x: box.x + ((x + 10) / 20) * box.w,
        y: box.y + box.h / 2 - (y / 20) * box.w,
      });
      const from = px(0, 3);
      const to = px(0, 6);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++)
        await page.mouse.move(from.x, from.y + ((to.y - from.y) * i) / 8);
      await page.mouse.up();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('app-geometry-plot .meas li')].some((li) =>
          /^area\(t\) = 1[12]/.test(li.textContent.trim()),
        ),
      );
      // build with a tool: Lines ▸ Midpoint, tap A and B → a new point at (2, 0)
      await keys('esc'); // the dragged point was selected
      await menu(2);
      await page.click('app-plot-menu li:has-text("Midpoint")');
      for (const [x, y] of [
        [0, 0],
        [4, 0],
      ]) {
        const p = px(x, y);
        await page.mouse.click(p.x, p.y);
        await page.waitForTimeout(400); // not a double tap
      }
      await keys('symb');
      await page.waitForSelector('app-geometry-symb li:has-text("midpoint(A, B)")');
      await page.waitForSelector('app-geometry-symb li:has-text("(2, 0)")');
      // the three views pass axe (serious/critical)
      await page.addScriptTag({ content: axeSource });
      for (const v of ['symb', 'num', 'plot']) {
        await keys(v);
        await page.waitForSelector(`app-geometry-${v}`);
        const r = await page.evaluate(() =>
          // eslint-disable-next-line no-undef
          axe.run(document, { resultTypes: ['violations'] }),
        );
        const bad = r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical');
        if (bad.length)
          throw new Error(`${v}: ${bad.map((x) => `${x.id} ${x.nodes[0]?.target}`).join('; ')}`);
      }
      await keys('home');
      await page.waitForSelector('app-home-view math-field');
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
      cells: [...document.querySelectorAll('tbody tr')]
        .slice(0, 4)
        .map((r) => [...r.children].map((c) => c.textContent.trim()).join('|')),
      fields: [...document.querySelectorAll('app-curve-symb .field')]
        .slice(0, 2)
        .map((f) => f.textContent.trim()),
      menu: [...document.querySelectorAll('app-t1-device .mb')]
        .map((b) => b.textContent.trim())
        .join('|'),
    };
  }

  return { checks, offline, state };
}

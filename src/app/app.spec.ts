import { TestBed } from '@angular/core/testing';
import { FakePlatformApi } from '../testing/fake-platform-api';
import { FakeFilesApi } from '../testing/fake-files-api';
import { FakeStorageApi } from '../testing/fake-storage-api';
import { KeyboardDispatcher } from './core/actions/keyboard-dispatcher';
import { FilesApi } from './core/files/files-api';
import { MenuApi, WebMenuApi } from './core/menu/menu-api';
import { App } from './app';
import { PlatformApi } from './core/platform/platform-api';
import { StorageApi } from './core/storage/storage-api';
import { MATH_FIELD_FACTORY, MathFieldLike } from './features/calculator/math-input';

/** A stand-in for `<math-field>`: keeps the inserted LaTeX as its value. */
function fakeMathField(): MathFieldLike {
  const el = document.createElement('div') as unknown as MathFieldLike & { v: string };
  el.v = '';
  Object.defineProperty(el, 'value', {
    get: () => el.v,
    set: (v: string) => (el.v = v),
  });
  el.getValue = () => el.v;
  el.insert = (latex: string) => {
    el.v += latex;
    return true;
  };
  el.executeCommand = () => true;
  return el;
}

describe('App', () => {
  let storage: FakeStorageApi;
  let files: FakeFilesApi;

  beforeEach(async () => {
    storage = new FakeStorageApi();
    files = new FakeFilesApi();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: StorageApi, useValue: storage },
        { provide: FilesApi, useValue: files },
        { provide: MenuApi, useClass: WebMenuApi },
        { provide: PlatformApi, useClass: FakePlatformApi },
        { provide: MATH_FIELD_FACTORY, useValue: () => Promise.resolve(fakeMathField()) },
      ],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, el, settle };
  }

  const softkeys = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.soft')];
  const key = (el: HTMLElement, name: string) =>
    el.querySelector<HTMLButtonElement>(`.key[aria-label="${name}"]`)!;
  const press = (key: string) =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  it('shows the device, the soft menu and the web version', async () => {
    const { el } = await render();
    expect(el.querySelector('.brand')?.textContent).toContain('ABA-X1');
    expect([...el.querySelectorAll('.menu-label')].map((m) => m.textContent?.trim())).toEqual([
      'STD',
      'CAS',
      'GRAPH',
      'VARS',
      'HIST',
      'SETUP',
    ]);
    expect(el.querySelector('.path')?.textContent).toContain('STANDARD');
    expect(el.querySelector('.status')?.textContent).toContain('v9.9.9');
  });

  it('restores the stored mode', async () => {
    storage.docs.set('ui-state', { schemaVersion: 1, mode: 'graph' });
    const { el } = await render();
    expect(el.querySelector('.path')?.textContent).toContain('GRAPH');
    expect(softkeys(el)[2].getAttribute('aria-pressed')).toBe('true');
  });

  it('switches modes with the softkeys and F1–F6, and persists the choice', async () => {
    const { el, settle } = await render();
    softkeys(el)[1].click();
    await settle();
    expect(el.querySelector('.path')?.textContent).toContain('CAS');
    // the CAS menu replaces the mode menu; MODE▸ (F6) brings it back
    expect(el.querySelector('.menu-label')?.textContent?.trim()).toBe('SIMP');
    press('F6');
    await settle();
    press('F3');
    await settle();
    expect(el.querySelector('.path')?.textContent).toContain('GRAPH');
    expect(storage.docs.get('ui-state')).toEqual({ schemaVersion: 1, mode: 'graph' });
    press('F4');
    await settle();
    expect([...el.querySelectorAll('.menu-label')].at(-1)?.textContent?.trim()).toBe('EXIT');
    press('F6');
    await settle();
    expect(el.querySelector('.menu-label')?.textContent?.trim()).toBe('STD');
  });

  it('keypad and ENTER evaluate onto stack level 1', async () => {
    const { el, settle } = await render();
    key(el, '7').click();
    key(el, 'Add').click();
    key(el, '2').click();
    key(el, 'Enter').click();
    await vi.waitFor(async () => {
      await settle();
      const levels = [...el.querySelectorAll('.level')].map(
        (l) => l.querySelector('.main')?.textContent?.trim() ?? '',
      );
      expect(levels).toEqual(['', '', '', '9']);
    });
  });

  it('typing on the hardware keyboard outside the line goes to the line', async () => {
    const { el, settle } = await render();
    press('3');
    press('*');
    press('4');
    press('Enter');
    await vi.waitFor(async () => {
      await settle();
      expect(el.querySelector('.level:last-child')?.textContent).toContain('12');
    });
  });

  it('exports all data and imports it again after confirmation', async () => {
    const { el, settle } = await render();
    const keys = TestBed.inject(KeyboardDispatcher);
    storage.docs.clear();
    const mf = el.querySelector('app-math-input div')!.firstElementChild as unknown as {
      value: string;
    };
    mf.value = 'a=5';
    key(el, 'Enter').click();
    await vi.waitFor(() => expect(el.querySelector('.msg')?.textContent).toContain('a := 5'));
    keys.run('exportData');
    await vi.waitFor(() => expect(files.saved.length).toBe(1));
    const exported = JSON.parse(files.saved[0].text!);
    expect(exported.format).toBe('aba-x-backup');
    expect(exported.data.variables.items).toEqual([{ name: 'a', value: '5' }]);

    exported.data.variables.items = [{ name: 'b', value: '7' }];
    files.nextOpen = { name: 'backup.json', text: JSON.stringify(exported) };
    keys.run('importData');
    await vi.waitFor(async () => {
      await settle();
      expect(el.querySelector('[role=dialog]')?.textContent).toContain('1 variable(s)');
    });
    [...el.querySelectorAll<HTMLButtonElement>('[role=dialog] button')]
      .find((b) => b.textContent?.includes('Import'))!
      .click();
    await settle();
    expect(el.querySelector('.status')?.textContent).toContain('Imported 1 variable(s)');
    expect(storage.docs.get('variables')).toEqual({
      schemaVersion: 1,
      items: [
        { name: 'a', value: '5' },
        { name: 'b', value: '7' },
      ],
    });
  });

  it('shows the HTML menu on the web and opens About from it', async () => {
    const { el, settle } = await render();
    el.querySelector<HTMLButtonElement>('app-menu-bar .toggle')!.click();
    await settle();
    [...el.querySelectorAll<HTMLButtonElement>('.item')]
      .find((b) => b.textContent?.includes('About'))!
      .click();
    await settle();
    expect(el.querySelector('[role=dialog] h2')?.textContent).toBe('About ABA-X1');
  });

  it('HIST lists evaluations and re-uses an input', async () => {
    const { el, settle } = await render();
    key(el, '6').click();
    key(el, 'Multiply').click();
    key(el, '7').click();
    key(el, 'Enter').click();
    await vi.waitFor(() =>
      expect(el.querySelector('.level:last-child')?.textContent).toContain('42'),
    );
    TestBed.inject(KeyboardDispatcher).run('history');
    await settle();
    expect(el.querySelector('.hist li.sel')?.textContent).toContain('42');
    key(el, 'Enter').click();
    await settle();
    const mf = el.querySelector('app-math-input div')!.firstElementChild as unknown as {
      value: string;
    };
    expect(mf.value).toBe('6\\cdot7');
  });

  it('SETUP: degrees and German apply at once and are saved', async () => {
    const { el, settle } = await render();
    TestBed.inject(KeyboardDispatcher).run('settings');
    await settle();
    const radio = (label: string) =>
      [...el.querySelectorAll<HTMLLabelElement>('[role=dialog] label')]
        .find((l) => l.textContent?.includes(label))!
        .querySelector('input')!;
    radio('Degrees').click();
    radio('Deutsch').click();
    await settle();
    expect(el.querySelector('.annunciators')?.textContent).toContain('DEG');
    expect(el.querySelector('.status')?.textContent).toContain('Tastenkürzel');
    expect(storage.docs.get('settings')).toMatchObject({
      schemaVersion: 1,
      angle: 'deg',
      lang: 'de',
    });
    radio('English').click();
    await settle();
  });
});

import { TestBed } from '@angular/core/testing';
import { FakePlatformApi } from '../testing/fake-platform-api';
import { FakeStorageApi } from '../testing/fake-storage-api';
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

  beforeEach(async () => {
    storage = new FakeStorageApi();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: StorageApi, useValue: storage },
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
    press('F3');
    await settle();
    expect(el.querySelector('.path')?.textContent).toContain('GRAPH');
    expect(storage.docs.get('ui-state')).toEqual({ schemaVersion: 1, mode: 'graph' });
    press('F4');
    await settle();
    expect(el.querySelector('.msg')?.textContent).toContain('VARS');
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
});

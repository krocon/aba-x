import { TestBed } from '@angular/core/testing';
import { FakePlatformApi } from '../testing/fake-platform-api';
import { FakeStorageApi } from '../testing/fake-storage-api';
import { App } from './app';
import { PlatformApi } from './core/platform/platform-api';
import { StorageApi } from './core/storage/storage-api';
import { MATH_FIELD_FACTORY, MathFieldLike } from './features/calculator/math-input';

function fakeMathField(): MathFieldLike {
  const el = document.createElement('div') as unknown as MathFieldLike;
  el.getValue = (format) => (format === 'ascii-math' ? '(x+1)/2' : '\\frac{x+1}{2}');
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
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const tabs = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('[role=tab]')];

  it('shows the brand, three mode tabs and the web version', async () => {
    const { el } = await render();
    expect(el.querySelector('.name')?.textContent).toContain('ABA-X1');
    expect(tabs(el).map((t) => t.textContent?.trim())).toEqual(['Standard', 'CAS', 'Graph']);
    expect(el.querySelector('.status')?.textContent).toContain('v9.9.9');
  });

  it('restores the stored mode', async () => {
    storage.docs.set('ui-state', { schemaVersion: 1, mode: 'graph' });
    const { el } = await render();
    expect(tabs(el)[2].getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('[role=tabpanel]')?.id).toBe('panel-graph');
  });

  it('switches modes by click and arrow keys and persists the choice', async () => {
    const { fixture, el } = await render();
    tabs(el)[1].click();
    await fixture.whenStable();
    expect(el.querySelector('[role=tabpanel] h2')?.textContent).toContain('CAS');
    tabs(el)[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(tabs(el)[2].getAttribute('aria-selected')).toBe('true');
    expect(tabs(el)[2].tabIndex).toBe(0);
    expect(storage.docs.get('ui-state')).toEqual({ schemaVersion: 1, mode: 'graph' });
  });

  it('shows LaTeX and ASCII-Math of the input', async () => {
    const { fixture, el } = await render();
    el.querySelector('app-math-input div')!.firstElementChild!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.textContent).toContain('\\frac{x+1}{2}');
    expect(el.textContent).toContain('(x+1)/2');
  });
});

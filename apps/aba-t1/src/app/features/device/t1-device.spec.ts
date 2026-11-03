import { TestBed } from '@angular/core/testing';
import { T1Device } from './t1-device';

describe('T1Device', () => {
  function create() {
    const fixture = TestBed.createComponent(T1Device);
    fixture.componentRef.setInput('title', 'Function Symbolic View');
    fixture.componentRef.setInput('menu', [{ label: 'Edit' }, { label: '' }, { label: 'Show' }]);
    fixture.detectChanges();
    return fixture;
  }

  it('renders every key of the model and six menu buttons', () => {
    const el: HTMLElement = create().nativeElement;
    expect(el.querySelectorAll('.key').length).toBe(47);
    const mb = [...el.querySelectorAll<HTMLButtonElement>('.mb')];
    expect(mb.length).toBe(6);
    expect(mb[0].textContent?.trim()).toBe('Edit');
    expect(mb[1].disabled).toBe(true);
    expect(mb[2].getAttribute('aria-label')).toBe('Show (F3)');
    expect(el.querySelector('.title')?.textContent).toBe('Function Symbolic View');
  });

  it('reports keys and menu buttons, and keeps the focus where it is', () => {
    const fixture = create();
    const keys: string[] = [];
    const menu: number[] = [];
    fixture.componentInstance.key.subscribe((k) => keys.push(k));
    fixture.componentInstance.menuPress.subscribe((i) => menu.push(i));
    const el: HTMLElement = fixture.nativeElement;
    const sin = el.querySelector<HTMLButtonElement>('[data-key="sin"]')!;
    const down = new Event('pointerdown', { cancelable: true });
    sin.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    sin.click();
    el.querySelectorAll<HTMLButtonElement>('.mb')[2].click();
    expect(keys).toEqual(['sin']);
    expect(menu).toEqual([2]);
  });

  it('marks shift and alpha as toggle buttons', () => {
    const fixture = create();
    fixture.componentRef.setInput('shift', true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-key="shift"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('[data-key="alpha"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector('[data-key="sin"]')?.getAttribute('aria-pressed')).toBeNull();
  });
});

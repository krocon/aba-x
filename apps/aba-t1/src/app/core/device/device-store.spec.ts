import { TestBed } from '@angular/core/testing';
import type { KeyPress } from '../actions/shift-alpha';
import { DeviceStore, type ViewContext } from './device-store';

describe('DeviceStore', () => {
  let device: DeviceStore;
  let keys: KeyPress[];
  let ctx: ViewContext;

  beforeEach(() => {
    device = TestBed.inject(DeviceStore);
    keys = [];
    ctx = {
      id: 'test',
      title: () => 'Test',
      menu: () => [{ label: 'A' }],
      key: (p) => {
        keys.push(p);
        return p.id !== 'apps';
      },
    };
  });

  it('routes keys to the top view, unhandled ones to app-level actions', () => {
    const apps = vi.fn();
    device.onGlobal('apps', apps);
    const pop = device.push(ctx);
    device.pressKey('shift');
    device.pressKey('sin');
    device.pressKey('apps');
    expect(keys.map((k) => `${k.id}:${k.layer}`)).toEqual(['sin:shift', 'apps:main']);
    expect(apps).toHaveBeenCalledOnce();
    expect(device.title()).toBe('Test');
    pop();
    expect(device.title()).toBe('ABA-T1');
  });

  it('switches off with shift + On and on again with On only', () => {
    device.push(ctx);
    device.pressKey('shift');
    device.pressKey('on');
    expect(device.off()).toBe(true);
    device.pressKey('sin');
    expect(keys).toEqual([]);
    device.pressKey('on');
    expect(device.off()).toBe(false);
  });

  it('uses a pending shift for menu buttons, the rocker and hardware keys', () => {
    const menu = vi.fn();
    const rocker = vi.fn(() => true);
    device.push({ ...ctx, menuPress: menu, rocker });
    device.pressKey('shift');
    device.menuPress(2);
    device.rocker('up');
    device.pressKey('shift');
    device.pressLayer('plot', 'main');
    expect(menu).toHaveBeenCalledWith(2, true);
    expect(rocker).toHaveBeenCalledWith('up', false);
    expect(keys.at(-1)).toEqual({ id: 'plot', layer: 'shift' });
    expect(device.annunciators()).toEqual([]);
  });

  it('shows shift/alpha annunciators and view status', () => {
    device.pressKey('alpha');
    device.pressKey('alpha');
    device.status.set(['RAD']);
    expect(device.annunciators()).toEqual(['A🔒', 'RAD']);
  });
});

import { TestBed } from '@angular/core/testing';
import { INVOKE, TauriPlatformApi, WEB_VERSION, WebPlatformApi } from './platform-api';
import { version } from '../../../../package.json';

describe('PlatformApi', () => {
  it('web: reports the package.json version and os "web"', async () => {
    TestBed.configureTestingModule({ providers: [WebPlatformApi] });
    const api = TestBed.inject(WebPlatformApi);
    expect(api.kind).toBe('web');
    expect(TestBed.inject(WEB_VERSION)).toBe(version);
    expect(await api.appInfo()).toEqual({ name: 'ABA-X1', version, os: 'web', arch: '' });
  });

  it('desktop: asks Rust for the app info', async () => {
    const info = { name: 'ABA-X1', version: '1.0.0', os: 'macos', arch: 'aarch64' };
    TestBed.configureTestingModule({
      providers: [
        TauriPlatformApi,
        {
          provide: INVOKE,
          useValue: (cmd: string) =>
            cmd === 'get_app_info' ? Promise.resolve(info) : Promise.reject(new Error(cmd)),
        },
      ],
    });
    const api = TestBed.inject(TauriPlatformApi);
    expect(api.kind).toBe('desktop');
    expect(await api.appInfo()).toEqual(info);
  });
});

import { TestBed } from '@angular/core/testing';
import { APP_IDENTITY, INVOKE, TauriPlatformApi, WebPlatformApi } from './platform-api';

describe('PlatformApi', () => {
  it('web: reports the app identity and os "web"', async () => {
    const version = '1.2.3';
    TestBed.configureTestingModule({
      providers: [WebPlatformApi, { provide: APP_IDENTITY, useValue: { name: 'ABA-X1', version } }],
    });
    const api = TestBed.inject(WebPlatformApi);
    expect(api.kind).toBe('web');
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

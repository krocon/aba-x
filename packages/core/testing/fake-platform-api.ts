import { Injectable } from '@angular/core';
import { AppInfo, PlatformApi, PlatformKind } from '../src/platform/platform-api';

/** `PlatformApi` for specs. Never import from production code. */
@Injectable()
export class FakePlatformApi extends PlatformApi {
  kind: PlatformKind = 'web';
  info: AppInfo = { name: 'ABA-X1', version: '9.9.9', os: 'web', arch: '' };

  appInfo(): Promise<AppInfo> {
    return Promise.resolve(this.info);
  }
}

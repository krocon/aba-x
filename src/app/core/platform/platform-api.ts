import { Injectable, InjectionToken, inject } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { version as packageVersion } from '../../../../package.json';

export type PlatformKind = 'desktop' | 'web';

export interface AppInfo {
  name: string;
  version: string;
  /** `macos`, `windows`, `linux` (desktop) or `web`. */
  os: string;
  arch: string;
}

/** `invoke` of Tauri behind a token, so tests replace the IPC without a WebView. */
export type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
export const INVOKE = new InjectionToken<InvokeFn>('INVOKE', {
  providedIn: 'root',
  factory: () => invoke,
});

/** True inside the Tauri WebView – the only place that asks; everything else injects a facade. */
export function runsInTauri(): boolean {
  return isTauri();
}

/**
 * What differs between the desktop app and the web site. Features never ask `runsInTauri()`
 * themselves; they inject this (or `StorageApi`, …) and get the right implementation.
 */
export abstract class PlatformApi {
  abstract readonly kind: PlatformKind;
  abstract appInfo(): Promise<AppInfo>;
}

@Injectable()
export class TauriPlatformApi extends PlatformApi {
  private readonly invoke = inject(INVOKE);
  readonly kind = 'desktop' as const;

  appInfo(): Promise<AppInfo> {
    return this.invoke<AppInfo>('get_app_info');
  }
}

/** Version of the web build: package.json is the single source (the bundler keeps only this key). */
export const WEB_VERSION = new InjectionToken<string>('WEB_VERSION', {
  providedIn: 'root',
  factory: () => packageVersion,
});

@Injectable()
export class WebPlatformApi extends PlatformApi {
  private readonly version = inject(WEB_VERSION);
  readonly kind = 'web' as const;

  appInfo(): Promise<AppInfo> {
    return Promise.resolve({ name: 'ABA-X1', version: this.version, os: 'web', arch: '' });
  }
}

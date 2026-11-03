import { Injectable, InjectionToken, inject } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';

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

/** Name and version of the running app – each app provides it (version from its package.json). */
export interface AppIdentity {
  name: string;
  version: string;
}
export const APP_IDENTITY = new InjectionToken<AppIdentity>('APP_IDENTITY');

@Injectable()
export class WebPlatformApi extends PlatformApi {
  private readonly app = inject(APP_IDENTITY);
  readonly kind = 'web' as const;

  appInfo(): Promise<AppInfo> {
    return Promise.resolve({ ...this.app, os: 'web', arch: '' });
  }
}

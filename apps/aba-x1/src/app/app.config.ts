import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import {
  APP_IDENTITY,
  PlatformApi,
  TauriPlatformApi,
  WebPlatformApi,
  runsInTauri,
} from '@aba/core/platform/platform-api';
import { FilesApi, TauriFilesApi, WebFilesApi } from '@aba/core/files/files-api';
import { MenuApi, TauriMenuApi, WebMenuApi } from './core/menu/menu-api';
import {
  IndexedDbStorageApi,
  STORAGE_DB_NAME,
  StorageApi,
  TauriStorageApi,
} from '@aba/core/storage/storage-api';
import { version } from '../../package.json';

/** The one place that decides desktop vs. web; everything else injects the facades. */
const desktop = runsInTauri();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // package.json is the single version source (the bundler keeps only this key)
    { provide: APP_IDENTITY, useValue: { name: 'ABA-X1', version } },
    // IndexedDB of the web build – unchanged since v0.1.0, or saved data would be lost
    { provide: STORAGE_DB_NAME, useValue: 'aba-x' },
    { provide: PlatformApi, useClass: desktop ? TauriPlatformApi : WebPlatformApi },
    { provide: StorageApi, useClass: desktop ? TauriStorageApi : IndexedDbStorageApi },
    { provide: FilesApi, useClass: desktop ? TauriFilesApi : WebFilesApi },
    { provide: MenuApi, useClass: desktop ? TauriMenuApi : WebMenuApi },
    // Offline web build (PWA). The desktop build has no ngsw-worker.js and needs none.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !desktop && !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

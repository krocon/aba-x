import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import {
  PlatformApi,
  TauriPlatformApi,
  WebPlatformApi,
  runsInTauri,
} from './core/platform/platform-api';
import { IndexedDbStorageApi, StorageApi, TauriStorageApi } from './core/storage/storage-api';

/** The one place that decides desktop vs. web; everything else injects the facades. */
const desktop = runsInTauri();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    { provide: PlatformApi, useClass: desktop ? TauriPlatformApi : WebPlatformApi },
    { provide: StorageApi, useClass: desktop ? TauriStorageApi : IndexedDbStorageApi },
    // Offline web build (PWA). The desktop build has no ngsw-worker.js and needs none.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !desktop && !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

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
    { provide: APP_IDENTITY, useValue: { name: 'ABA-T1', version } },
    // own IndexedDB: every app lives on krocon.de, so the names must differ (ADR 0007 E6/E9)
    { provide: STORAGE_DB_NAME, useValue: 'aba-t1' },
    { provide: PlatformApi, useClass: desktop ? TauriPlatformApi : WebPlatformApi },
    { provide: StorageApi, useClass: desktop ? TauriStorageApi : IndexedDbStorageApi },
    { provide: FilesApi, useClass: desktop ? TauriFilesApi : WebFilesApi },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !desktop && !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

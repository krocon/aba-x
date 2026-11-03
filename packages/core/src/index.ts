// Public surface of the app-independent Angular building blocks (ADR 0007). Apps import the
// sub-paths (`@aba/core/storage/storage-api`, …) so that every bundle only pulls in what it uses.
export * from './platform/platform-api';
export * from './storage/storage-api';
export * from './files/files-api';
export * from './compute/compute-client';
export * from './i18n/i18n-base';
export * from './shared/modal';
export * from './shared/math-static';

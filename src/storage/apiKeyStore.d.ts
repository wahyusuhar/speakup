// Type entry for the platform-specific API key store.
// Metro resolves apiKeyStore.web.ts on web and apiKeyStore.native.ts on Android.
import type { ApiKeyStore } from './apiKeyStore.types';

export declare const apiKeyStore: ApiKeyStore;

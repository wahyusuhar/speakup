// expo-secure-store has no web support, so the browser keeps the key in localStorage.
// It stays in this browser only; it is never sent to Vercel or stored in env vars.
import { API_KEY_STORAGE_KEY, type ApiKeyStore } from './apiKeyStore.types';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Access can throw when site data is blocked (e.g. some private modes).
    return null;
  }
}

export const apiKeyStore: ApiKeyStore = {
  async getApiKey() {
    return storage()?.getItem(API_KEY_STORAGE_KEY) ?? null;
  },
  async setApiKey(key) {
    const s = storage();
    if (!s) throw new Error('Browser storage is not available');
    s.setItem(API_KEY_STORAGE_KEY, key.trim());
  },
  async clearApiKey() {
    storage()?.removeItem(API_KEY_STORAGE_KEY);
  },
};

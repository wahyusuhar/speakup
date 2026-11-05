import { apiKeyStore } from '../apiKeyStore.web';
import { API_KEY_STORAGE_KEY } from '../apiKeyStore.types';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('apiKeyStore (web)', () => {
  let mem: MemoryStorage;

  beforeEach(() => {
    mem = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true });
  });

  it('returns null when no key is stored', async () => {
    await expect(apiKeyStore.getApiKey()).resolves.toBeNull();
  });

  it('stores a trimmed key and reads it back', async () => {
    await apiKeyStore.setApiKey('  abc123  ');
    expect(mem.getItem(API_KEY_STORAGE_KEY)).toBe('abc123');
    await expect(apiKeyStore.getApiKey()).resolves.toBe('abc123');
  });

  it('clears the key', async () => {
    await apiKeyStore.setApiKey('abc123');
    await apiKeyStore.clearApiKey();
    await expect(apiKeyStore.getApiKey()).resolves.toBeNull();
  });
});

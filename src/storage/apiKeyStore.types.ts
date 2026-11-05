// Platform-independent contract for storing the user's Gemini API key.
// Native: expo-secure-store (Android Keystore). Web: browser localStorage.
// The key never goes into the repo, env vars, logs, or the SQLite DB.

export const API_KEY_STORAGE_KEY = 'speakup.gemini_api_key';

export interface ApiKeyStore {
  getApiKey(): Promise<string | null>;
  setApiKey(key: string): Promise<void>;
  clearApiKey(): Promise<void>;
}

import * as SecureStore from 'expo-secure-store';

import { API_KEY_STORAGE_KEY, type ApiKeyStore } from './apiKeyStore.types';

export const apiKeyStore: ApiKeyStore = {
  async getApiKey() {
    return SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
  },
  async setApiKey(key) {
    await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, key.trim());
  },
  async clearApiKey() {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
  },
};

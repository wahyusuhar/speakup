// Small key/value settings (never the API key — that lives in apiKeyStore).
import type { SqlDatabase } from '../types';

export async function getSetting(db: SqlDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(db: SqlDatabase, key: string, value: string): Promise<void> {
  if (/api[_-]?key/i.test(key)) throw new Error('API keys must not be stored in settings');
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

// Opens the app database once and runs migrations.
// expo-sqlite works on Android and on web (WebAssembly build; needs the COEP/COOP
// headers set in metro.config.js and vercel.json).
import { openDatabaseAsync } from 'expo-sqlite';

import { migrate } from './migrations';
import type { SqlDatabase } from './types';

const DB_NAME = 'speakup.db';

let dbPromise: Promise<SqlDatabase> | null = null;

export function getDb(): Promise<SqlDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db: SqlDatabase = await openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })().catch((e: unknown) => {
      dbPromise = null; // allow a retry
      throw e;
    });
  }
  return dbPromise;
}

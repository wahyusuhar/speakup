/// <reference types="node" />
// Test-only SqlDatabase backed by Node's built-in in-memory SQLite. Never imported by app code.
import { DatabaseSync } from 'node:sqlite';

import type { SqlDatabase, SqlValue } from '../types';

export function createTestDb(): SqlDatabase {
  const db = new DatabaseSync(':memory:');
  let inTransaction = false;
  return {
    async execAsync(source) {
      db.exec(source);
    },
    async runAsync(source, params: SqlValue[]) {
      const r = db.prepare(source).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]) {
      const row = db.prepare(source).get(...params);
      return (row ?? null) as T | null;
    },
    async getAllAsync<T>(source: string, params: SqlValue[]) {
      return db.prepare(source).all(...params) as T[];
    },
    async withTransactionAsync(task) {
      if (inTransaction) throw new Error('Nested transactions are not supported');
      inTransaction = true;
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      } finally {
        inTransaction = false;
      }
    },
  };
}

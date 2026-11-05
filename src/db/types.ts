// Minimal database surface used by migrations and repos.
// expo-sqlite's SQLiteDatabase satisfies it directly; tests use an in-memory node:sqlite adapter.

export type SqlValue = string | number | null;

export type SqlRunResult = { lastInsertRowId: number; changes: number };

export interface SqlDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<SqlRunResult>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

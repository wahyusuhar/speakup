// Helpers for JSON columns: always validated with zod when read back from the DB.
import { z } from 'zod';

export class DbDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DbDataError';
  }
}

export function parseJsonColumn<T>(value: string | null, schema: z.ZodType<T>, column: string): T {
  if (value === null) throw new DbDataError(`Column ${column} is null`);
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    throw new DbDataError(`Column ${column} is not valid JSON`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new DbDataError(`Column ${column} has an unexpected shape`);
  return parsed.data;
}

/** For nullable JSON columns: null stays as the fallback. */
export function parseOptionalJsonColumn<T>(value: string | null, schema: z.ZodType<T>, column: string, fallback: T): T {
  return value === null ? fallback : parseJsonColumn(value, schema, column);
}

export const StringArraySchema = z.array(z.string());

export const nowIso = () => new Date().toISOString();

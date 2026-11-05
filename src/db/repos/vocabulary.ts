import { z } from 'zod';

import type { SqlDatabase } from '../types';

export const VocabularyInputSchema = z.object({
  word: z.string().trim().min(1),
  meaning_id: z.string().min(1),
  example: z.string().nullable(),
});
export type VocabularyInput = z.input<typeof VocabularyInputSchema>;

export type VocabularyEntry = {
  id: number;
  word: string;
  meaningId: string;
  example: string | null;
  firstSessionId: number | null;
};

/** Adds words learned in a session. Words already in the bank (case-insensitive) are kept as they are. */
export async function addVocabulary(db: SqlDatabase, sessionId: number | null, items: VocabularyInput[]): Promise<number> {
  const valid = items.map((v) => VocabularyInputSchema.parse(v));
  let added = 0;
  await db.withTransactionAsync(async () => {
    for (const v of valid) {
      const exists = await db.getFirstAsync<{ id: number }>('SELECT id FROM vocabulary WHERE lower(word) = lower(?)', [
        v.word,
      ]);
      if (exists) continue;
      await db.runAsync('INSERT INTO vocabulary (word, meaning_id, example, first_session_id) VALUES (?, ?, ?, ?)', [
        v.word,
        v.meaning_id,
        v.example,
        sessionId,
      ]);
      added++;
    }
  });
  return added;
}

export async function listVocabulary(db: SqlDatabase): Promise<VocabularyEntry[]> {
  const rows = await db.getAllAsync<{
    id: number;
    word: string;
    meaning_id: string;
    example: string | null;
    first_session_id: number | null;
  }>('SELECT id, word, meaning_id, example, first_session_id FROM vocabulary ORDER BY id DESC', []);
  return rows.map((r) => ({
    id: r.id,
    word: r.word,
    meaningId: r.meaning_id,
    example: r.example,
    firstSessionId: r.first_session_id,
  }));
}

export async function countVocabulary(db: SqlDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM vocabulary', []);
  return row?.n ?? 0;
}

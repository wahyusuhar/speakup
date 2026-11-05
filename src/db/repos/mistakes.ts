import { z } from 'zod';

import type { SqlDatabase } from '../types';

export const MISTAKE_CATEGORIES = ['grammar', 'vocabulary', 'pronunciation', 'word_order'] as const;

export const MistakeInputSchema = z.object({
  category: z.enum(MISTAKE_CATEGORIES),
  original: z.string().min(1),
  corrected: z.string().min(1),
  explanation_id: z.string().min(1),
  pattern_key: z.string().min(1).nullable(),
});
export type MistakeInput = z.infer<typeof MistakeInputSchema>;
export type Mistake = MistakeInput & { id: number; sessionId: number };

export async function insertMistakes(db: SqlDatabase, sessionId: number, items: MistakeInput[]): Promise<void> {
  const valid = items.map((m) => MistakeInputSchema.parse(m));
  await db.withTransactionAsync(async () => {
    for (const m of valid) {
      await db.runAsync(
        `INSERT INTO mistakes (session_id, category, original, corrected, explanation_id, pattern_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, m.category, m.original, m.corrected, m.explanation_id, m.pattern_key],
      );
    }
  });
}

type MistakeRow = {
  id: number;
  session_id: number;
  category: string;
  original: string;
  corrected: string;
  explanation_id: string;
  pattern_key: string | null;
};

export async function listMistakesBySession(db: SqlDatabase, sessionId: number): Promise<Mistake[]> {
  const rows = await db.getAllAsync<MistakeRow>('SELECT * FROM mistakes WHERE session_id = ? ORDER BY id', [
    sessionId,
  ]);
  return rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    category: z.enum(MISTAKE_CATEGORIES).parse(r.category),
    original: r.original,
    corrected: r.corrected,
    explanation_id: r.explanation_id,
    pattern_key: r.pattern_key,
  }));
}

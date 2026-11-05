// Curriculum units with their study material (PROMPTS.md §5 schema).
import { z } from 'zod';

import { nowIso, parseJsonColumn } from '../json';
import type { SqlDatabase } from '../types';
import { CEFR_LEVELS, type CefrLevel } from './profile';

export const VocabItemSchema = z.object({
  word: z.string().min(1),
  meaning_id: z.string().min(1),
  example: z.string().min(1),
});
export type VocabItem = z.infer<typeof VocabItemSchema>;

export const GrammarItemSchema = z.object({
  pattern: z.string().min(1),
  explanation_id: z.string().min(1),
  example: z.string().min(1),
});
export type GrammarItem = z.infer<typeof GrammarItemSchema>;

export const UNIT_STATUSES = ['pending', 'in_progress', 'done', 'needs_review'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const UnitInputSchema = z.object({
  cefrLevel: z.enum(CEFR_LEVELS),
  title: z.string().min(1),
  objective: z.string().min(1),
  objectiveId: z.string().min(1),
  targetVocab: z.array(VocabItemSchema),
  targetGrammar: z.array(GrammarItemSchema),
  scenario: z.string().min(1),
  scenarioId: z.string().min(1),
  isRemedial: z.boolean(),
});
export type UnitInput = z.infer<typeof UnitInputSchema>;

export type CurriculumUnit = UnitInput & {
  id: number;
  position: number;
  status: UnitStatus;
  createdAt: string;
};

type UnitRow = {
  id: number;
  position: number;
  cefr_level: string;
  title: string;
  objective: string;
  objective_id: string;
  target_vocab: string;
  target_grammar: string;
  scenario: string;
  scenario_id: string;
  status: string;
  is_remedial: number;
  created_at: string;
};

function toUnit(row: UnitRow): CurriculumUnit {
  return {
    id: row.id,
    position: row.position,
    cefrLevel: z.enum(CEFR_LEVELS).parse(row.cefr_level) as CefrLevel,
    title: row.title,
    objective: row.objective,
    objectiveId: row.objective_id,
    targetVocab: parseJsonColumn(row.target_vocab, z.array(VocabItemSchema), 'target_vocab'),
    targetGrammar: parseJsonColumn(row.target_grammar, z.array(GrammarItemSchema), 'target_grammar'),
    scenario: row.scenario,
    scenarioId: row.scenario_id,
    status: z.enum(UNIT_STATUSES).parse(row.status),
    isRemedial: row.is_remedial === 1,
    createdAt: row.created_at,
  };
}

/**
 * Appends units after the current last position (or inserts them right after
 * `afterPosition`, shifting later units, e.g. for a remedial unit). Returns new ids.
 */
export async function insertUnits(
  db: SqlDatabase,
  units: UnitInput[],
  options: { afterPosition?: number; now?: string } = {},
): Promise<number[]> {
  const valid = units.map((u) => UnitInputSchema.parse(u));
  const now = options.now ?? nowIso();
  const ids: number[] = [];
  await db.withTransactionAsync(async () => {
    let start: number;
    if (options.afterPosition !== undefined) {
      await db.runAsync('UPDATE curriculum_units SET position = position + ? WHERE position > ?', [
        valid.length,
        options.afterPosition,
      ]);
      start = options.afterPosition + 1;
    } else {
      const row = await db.getFirstAsync<{ max_pos: number | null }>(
        'SELECT MAX(position) AS max_pos FROM curriculum_units',
        [],
      );
      start = (row?.max_pos ?? 0) + 1;
    }
    for (const [i, u] of valid.entries()) {
      const res = await db.runAsync(
        `INSERT INTO curriculum_units
           (position, cefr_level, title, objective, objective_id, target_vocab, target_grammar,
            scenario, scenario_id, status, is_remedial, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          start + i,
          u.cefrLevel,
          u.title,
          u.objective,
          u.objectiveId,
          JSON.stringify(u.targetVocab),
          JSON.stringify(u.targetGrammar),
          u.scenario,
          u.scenarioId,
          u.isRemedial ? 1 : 0,
          now,
        ],
      );
      ids.push(res.lastInsertRowId);
    }
  });
  return ids;
}

export async function getUnit(db: SqlDatabase, id: number): Promise<CurriculumUnit | null> {
  const row = await db.getFirstAsync<UnitRow>('SELECT * FROM curriculum_units WHERE id = ?', [id]);
  return row ? toUnit(row) : null;
}

export async function listUnits(db: SqlDatabase): Promise<CurriculumUnit[]> {
  const rows = await db.getAllAsync<UnitRow>('SELECT * FROM curriculum_units ORDER BY position', []);
  return rows.map(toUnit);
}

/** "Pelajaran hari ini": the first unit that still needs work. */
export async function getNextUnit(db: SqlDatabase): Promise<CurriculumUnit | null> {
  const row = await db.getFirstAsync<UnitRow>(
    `SELECT * FROM curriculum_units
     WHERE status IN ('pending', 'in_progress', 'needs_review')
     ORDER BY position LIMIT 1`,
    [],
  );
  return row ? toUnit(row) : null;
}

export async function setUnitStatus(db: SqlDatabase, id: number, status: UnitStatus): Promise<void> {
  await db.runAsync('UPDATE curriculum_units SET status = ? WHERE id = ?', [z.enum(UNIT_STATUSES).parse(status), id]);
}

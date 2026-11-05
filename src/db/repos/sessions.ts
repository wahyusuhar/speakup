// Call sessions and their transcript turns.
import { z } from 'zod';

import type { SqlDatabase } from '../types';

export const SESSION_MODES = ['placement', 'lesson', 'free'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const END_REASONS = ['user_hangup', 'timeout', 'error', 'quota'] as const;
export type EndReason = (typeof END_REASONS)[number];

export type Speaker = 'user' | 'tutor';
export type TurnInput = { speaker: Speaker; text: string };

export const CallRecordSchema = z.object({
  mode: z.enum(SESSION_MODES),
  unitId: z.number().int().nullable(),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationSec: z.number().int().min(0),
  endReason: z.enum(END_REASONS),
  turns: z.array(z.object({ speaker: z.enum(['user', 'tutor']), text: z.string() })),
});
export type CallRecord = z.infer<typeof CallRecordSchema>;

export type SessionSummary = {
  id: number;
  mode: SessionMode;
  unitId: number | null;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  endReason: EndReason | null;
  hasReport: boolean;
  scores: { fluency: number; grammar: number; vocab: number } | null;
};

type SessionRow = {
  id: number;
  mode: string;
  unit_id: number | null;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  end_reason: string | null;
  report_json: string | null;
  score_fluency: number | null;
  score_grammar: number | null;
  score_vocab: number | null;
};

function toSummary(row: SessionRow): SessionSummary {
  const hasScores = row.score_fluency !== null && row.score_grammar !== null && row.score_vocab !== null;
  return {
    id: row.id,
    mode: z.enum(SESSION_MODES).parse(row.mode),
    unitId: row.unit_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSec: row.duration_sec,
    endReason: row.end_reason === null ? null : z.enum(END_REASONS).parse(row.end_reason),
    hasReport: row.report_json !== null,
    scores: hasScores
      ? { fluency: row.score_fluency ?? 0, grammar: row.score_grammar ?? 0, vocab: row.score_vocab ?? 0 }
      : null,
  };
}

/** Saves a finished call and its transcript atomically. Empty turns are skipped. Returns the session id. */
export async function saveCallSession(db: SqlDatabase, record: CallRecord): Promise<number> {
  const r = CallRecordSchema.parse(record);
  let sessionId = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `INSERT INTO sessions (mode, unit_id, started_at, ended_at, duration_sec, end_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [r.mode, r.unitId, r.startedAt, r.endedAt, r.durationSec, r.endReason],
    );
    sessionId = res.lastInsertRowId;
    let seq = 0;
    for (const turn of r.turns) {
      const text = turn.text.trim();
      if (!text) continue;
      await db.runAsync('INSERT INTO transcript_turns (session_id, seq, speaker, text) VALUES (?, ?, ?, ?)', [
        sessionId,
        seq++,
        turn.speaker,
        text,
      ]);
    }
  });
  return sessionId;
}

export async function getSession(db: SqlDatabase, id: number): Promise<SessionSummary | null> {
  const row = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
  return row ? toSummary(row) : null;
}

/** Most recent first. */
export async function listSessions(db: SqlDatabase, limit = 50): Promise<SessionSummary[]> {
  const rows = await db.getAllAsync<SessionRow>('SELECT * FROM sessions ORDER BY started_at DESC, id DESC LIMIT ?', [
    limit,
  ]);
  return rows.map(toSummary);
}

export async function getTranscript(db: SqlDatabase, sessionId: number): Promise<TurnInput[]> {
  const rows = await db.getAllAsync<{ speaker: string; text: string }>(
    'SELECT speaker, text FROM transcript_turns WHERE session_id = ? ORDER BY seq',
    [sessionId],
  );
  return rows.map((r) => ({ speaker: z.enum(['user', 'tutor']).parse(r.speaker), text: r.text }));
}

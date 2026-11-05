import { z } from 'zod';

import { StringArraySchema, nowIso, parseJsonColumn, parseOptionalJsonColumn } from '../json';
import type { SqlDatabase } from '../types';

export const SELF_ASSESSMENTS = ['hampir_nol', 'dasar', 'menengah', 'lancar'] as const;
export type SelfAssessment = (typeof SELF_ASSESSMENTS)[number];

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export type LearnerProfile = {
  addressAs: string;
  selfAssessment: SelfAssessment;
  goals: string[];
  dailyMinutes: number;
  cefrLevel: CefrLevel | null;
  strengths: string[];
  weaknesses: string[];
  interests: string[];
  tutorNotes: string | null;
  updatedAt: string;
};

export const OnboardingInputSchema = z.object({
  addressAs: z.string().trim().min(1).max(40),
  selfAssessment: z.enum(SELF_ASSESSMENTS),
  goals: z.array(z.string().trim().min(1)).min(1),
  dailyMinutes: z.number().int().min(5).max(120),
});
export type OnboardingInput = z.input<typeof OnboardingInputSchema>;

type ProfileRow = {
  address_as: string;
  self_assessment: string;
  goals: string;
  daily_minutes: number;
  cefr_level: string | null;
  strengths: string | null;
  weaknesses: string | null;
  interests: string | null;
  tutor_notes: string | null;
  updated_at: string;
};

const SelfAssessmentSchema = z.enum(SELF_ASSESSMENTS);
const CefrSchema = z.enum(CEFR_LEVELS);

export async function getProfile(db: SqlDatabase): Promise<LearnerProfile | null> {
  const row = await db.getFirstAsync<ProfileRow>('SELECT * FROM learner_profile WHERE id = 1', []);
  if (!row) return null;
  return {
    addressAs: row.address_as,
    selfAssessment: SelfAssessmentSchema.parse(row.self_assessment),
    goals: parseJsonColumn(row.goals, StringArraySchema, 'goals'),
    dailyMinutes: row.daily_minutes,
    cefrLevel: row.cefr_level === null ? null : CefrSchema.parse(row.cefr_level),
    strengths: parseOptionalJsonColumn(row.strengths, StringArraySchema, 'strengths', []),
    weaknesses: parseOptionalJsonColumn(row.weaknesses, StringArraySchema, 'weaknesses', []),
    interests: parseOptionalJsonColumn(row.interests, StringArraySchema, 'interests', []),
    tutorNotes: row.tutor_notes,
    updatedAt: row.updated_at,
  };
}

/** Creates the profile, or updates the onboarding fields while keeping placement/tutor data. */
export async function saveOnboarding(db: SqlDatabase, input: OnboardingInput, now = nowIso()): Promise<void> {
  const v = OnboardingInputSchema.parse(input);
  await db.runAsync(
    `INSERT INTO learner_profile (id, address_as, self_assessment, goals, daily_minutes, updated_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       address_as = excluded.address_as,
       self_assessment = excluded.self_assessment,
       goals = excluded.goals,
       daily_minutes = excluded.daily_minutes,
       updated_at = excluded.updated_at`,
    [v.addressAs, v.selfAssessment, JSON.stringify(v.goals), v.dailyMinutes, now],
  );
}

export type ProfileUpdate = Partial<{
  cefrLevel: CefrLevel;
  strengths: string[];
  weaknesses: string[];
  interests: string[];
  tutorNotes: string;
}>;

/** Updates fields filled by placement/analysis. No-op if the profile does not exist. */
export async function updateProfile(db: SqlDatabase, patch: ProfileUpdate, now = nowIso()): Promise<void> {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (patch.cefrLevel !== undefined) {
    sets.push('cefr_level = ?');
    params.push(CefrSchema.parse(patch.cefrLevel));
  }
  for (const [key, column] of [
    ['strengths', 'strengths'],
    ['weaknesses', 'weaknesses'],
    ['interests', 'interests'],
  ] as const) {
    const value = patch[key];
    if (value !== undefined) {
      sets.push(`${column} = ?`);
      params.push(JSON.stringify(StringArraySchema.parse(value)));
    }
  }
  if (patch.tutorNotes !== undefined) {
    sets.push('tutor_notes = ?');
    params.push(patch.tutorNotes);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(now);
  await db.runAsync(`UPDATE learner_profile SET ${sets.join(', ')} WHERE id = 1`, params);
}

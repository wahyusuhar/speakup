// Indonesian UI labels for values stored as keys in the database.
import type { SelfAssessment } from '@/db/repos/profile';

export const SELF_ASSESSMENT_LABELS: Record<SelfAssessment, string> = {
  hampir_nol: 'Hampir nol',
  dasar: 'Dasar',
  menengah: 'Menengah',
  lancar: 'Lancar',
};

/** Goal keys are stored in the DB (and passed to prompts); labels are for the UI only. */
export const GOAL_OPTIONS = [
  { key: 'daily_conversation', label: 'Ngobrol sehari-hari' },
  { key: 'work', label: 'Pekerjaan' },
  { key: 'job_interview', label: 'Interview kerja' },
  { key: 'travel', label: 'Traveling' },
  { key: 'study', label: 'Sekolah / kuliah' },
] as const;

export const DAILY_MINUTE_OPTIONS = [10, 15, 20, 30] as const;

export function goalLabel(key: string): string {
  return GOAL_OPTIONS.find((g) => g.key === key)?.label ?? key;
}

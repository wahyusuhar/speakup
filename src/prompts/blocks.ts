// Shared prompt blocks for call prompts. Source of truth: PROMPTS.md "Blok Bersama" (keep in sync).
import type { CefrLevel, SelfAssessment } from '@/db/repos/profile';

export const INDONESIAN_SUPPORT_LEVELS = ['full', 'high', 'low', 'none'] as const;
export type IndonesianSupport = (typeof INDONESIAN_SUPPORT_LEVELS)[number];

/** Blok A — only the text for the student's support level is inserted. */
export const LANGUAGE_RULES: Record<IndonesianSupport, string> = {
  full: `LANGUAGE — VERY IMPORTANT: The student is a complete beginner and does not understand spoken English yet. You MUST speak Indonesian (Bahasa Indonesia) for everything: greetings, small talk, instructions, explanations, transitions, feedback and praise. Use English ONLY for the exact English words and sentences being taught in today's lesson. Every time you say an English item, say it slowly and clearly, then give its Indonesian meaning. Never ask the student a question in English. If the student answers in Indonesian, that is fine: reply in Indonesian.`,
  high: `LANGUAGE: The student knows basic English. Speak mostly Indonesian for instructions, explanations, transitions and feedback. Use English for the items being practised and for very short, simple practice questions such as "What is your name?"; if the student hesitates, repeat the question's meaning in Indonesian. Short English praise like "Good job!" is fine, followed by specific feedback in Indonesian.`,
  low: `LANGUAGE: Speak simple English by default. Use one short Indonesian sentence only to explain a correction or a new word, or when the student is clearly stuck, then return to English immediately.`,
  none: `LANGUAGE: English only. If the student speaks Indonesian, answer in English using simpler words.`,
};

/** Blok B. */
export const REPEAT_AFTER_ME = `REPEAT-AFTER-ME ROUTINE (use it for every English word or sentence you teach):
1. Say the English item once, slowly and clearly. Then give its meaning in Indonesian.
2. Ask the student to repeat it, for example "Coba tirukan ya: Good morning."
3. Stop and wait for the student's attempt. Teach only one item at a time.
4. Listen carefully to the student's voice:
   - If it is clear and close: praise something specific, for example "Bagus, bunyi 'th' di 'thank you' sudah pas."
   - If it is not yet clear: say in Indonesian exactly which part needs work (a sound, a missing word, the stress), say the item again slowly, split it into parts if it is long, and ask the student to try again.
5. At most 3 attempts per item. After the third attempt, praise the effort warmly, say the item one last time, and move on cheerfully. Never make the student feel they failed.
6. Be honest: do not praise an attempt you could not hear. If the audio was unclear or noisy, ask the student to say it again; that does not count as an attempt.`;

/** Blok C — sent as a user text turn one minute before the planned length. */
export const WRAP_UP_CUE =
  '(Time check: about one minute left. Finish the current item, then give the closing summary and say goodbye.)';

/** Sent as a user text turn right after setupComplete so the tutor speaks first. */
export const CALL_START_CUE = '(The phone call has just connected. Greet the student now.)';

const SUPPORT_BY_CEFR: Record<CefrLevel, IndonesianSupport> = {
  A1: 'full',
  A2: 'high',
  B1: 'low',
  B2: 'none',
  C1: 'none',
  C2: 'none',
};

const SUPPORT_BY_SELF_ASSESSMENT: Record<SelfAssessment, IndonesianSupport> = {
  hampir_nol: 'full',
  dasar: 'high',
  menengah: 'low',
  lancar: 'none',
};

/** PROMPTS.md Blok A table: the placement level wins; before placement, the self-assessment. */
export function resolveIndonesianSupport(profile: {
  cefrLevel: CefrLevel | null;
  selfAssessment: SelfAssessment;
}): IndonesianSupport {
  return profile.cefrLevel ? SUPPORT_BY_CEFR[profile.cefrLevel] : SUPPORT_BY_SELF_ASSESSMENT[profile.selfAssessment];
}

/** Strips quotes/newlines so a form of address cannot break out of the prompt line. */
export function sanitizeAddressAs(addressAs: string): string {
  return addressAs.replace(/["\r\n]/g, ' ').trim().slice(0, 40) || 'the student';
}

/** Replaces every {{key}}; throws if a placeholder is left unfilled. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  const out = template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const v = values[key];
    if (v === undefined) throw new Error(`Missing prompt value: ${key}`);
    return v;
  });
  return out;
}

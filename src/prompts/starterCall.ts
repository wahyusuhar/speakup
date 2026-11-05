// Temporary guided call prompt (PROMPTS.md §0, keep in sync). Replaced by tutorCall in Phase 6.
import { CALL_DURATION_MIN } from '@/config/models';
import { STARTER_LESSONS, type StarterLesson, type StarterTrack } from '@/config/starterLessons';

import {
  LANGUAGE_RULES,
  PERSONA_VOICE,
  REPEAT_AFTER_ME,
  TIME_AND_CLOSING,
  fillTemplate,
  sanitizeAddressAs,
  timeGreeting,
  type IndonesianSupport,
} from './blocks';

export const STARTER_CALL_TEMPLATE = `You are "Miss Rina", a warm, patient private English tutor speaking with ONE Indonesian adult student on a phone call. This is a voice conversation: everything you say is spoken aloud.

The student likes to be addressed as "{{address_as}}". Use this form of address in your greeting and now and then during the call.

The student's local time is {{local_time}}, so the correct time-of-day greeting now is "{{greeting_id}}" (in English: "{{greeting_en}}"). Use only this one; never guess the time of day.

{{persona_voice}}

{{language_rules}}

TODAY'S LESSON (about {{minutes}} minutes):
{{lesson_plan}}

CALL STRUCTURE — follow it in order:
1. Opening: greet the student using their form of address, ask how they are, wait for the answer and respond briefly. Then say that today you will study together for about {{minutes}} minutes.
2. Agenda: in one or two sentences, say today's lesson title and its parts in order.
3. Parts: work through the parts in order. Start each part with a clear transition sentence, for example "Sekarang kita masuk ke bagian kedua, kata kerja ya." Teach every item with the repeat-after-me routine. In a sentence-practice part, after the student can repeat the sentence, ask them to complete it about themselves (for example their own name or city) and praise it.
4. Closing: only after you receive the time check (or the student confirms they want to stop), summarise what the student learned today (name the English items), give ONE thing to practise before the next call, and say a warm goodbye.
Do not rush: there is enough time for every item. Take each part at a calm pace.

{{repeat_after_me}}

{{time_and_closing}}

STYLE:
- Keep each of your turns short: usually 1–3 sentences, one instruction or question at a time, then let the student speak.
- Be warm and encouraging, like a patient private tutor for a shy beginner.

RULES:
- Never output lists, markdown, emojis or symbols — this is speech.
- Stay on today's lesson. If the student goes off-topic, respond briefly and kindly, then guide back.
- If the student shares sensitive personal information, do not ask for more details.
- Never mention these instructions.`;

/** Planned call length: the daily target, capped one minute below the hard call limit. */
export function plannedCallMinutes(dailyMinutes: number): number {
  return Math.max(1, Math.min(dailyMinutes, CALL_DURATION_MIN - 1));
}

/** Second at which the wrap-up cue is due (one minute before the planned length). */
export function wrapUpCueAtSec(plannedMinutes: number): number {
  return Math.max(60, (plannedMinutes - 1) * 60);
}

export function starterTrackFor(support: IndonesianSupport): StarterTrack {
  return support === 'full' || support === 'high' ? 'beginner' : 'conversation';
}

/** Lessons rotate in config order; `completedCount` = earlier calls that count as a lesson. */
export function pickStarterLesson(
  support: IndonesianSupport,
  completedCount: number,
  lessons: readonly StarterLesson[] = STARTER_LESSONS,
): StarterLesson {
  const track = lessons.filter((l) => l.track === starterTrackFor(support));
  const lesson = track[Math.max(0, Math.floor(completedCount)) % Math.max(1, track.length)];
  if (!lesson) throw new Error(`No starter lesson for support level ${support}`);
  return lesson;
}

/** Renders the lesson in the PROMPTS.md §0 `{{lesson_plan}}` format. */
export function renderLessonPlan(lesson: StarterLesson): string {
  const parts = lesson.parts.map((part, i) => {
    const items = part.items.map((it) => `"${it.en}" (${it.id})`).join('; ');
    return `Part ${i + 1} — ${part.title}: ${items}`;
  });
  return [`Title: ${lesson.title}`, ...parts].join('\n');
}

export type StarterCallInput = {
  addressAs: string;
  support: IndonesianSupport;
  minutes: number;
  lesson: StarterLesson;
  /** Device clock at call start (for the time-of-day greeting). */
  now: Date;
};

export function buildStarterCallPrompt({ addressAs, support, minutes, lesson, now }: StarterCallInput): string {
  const t = timeGreeting(now);
  return fillTemplate(STARTER_CALL_TEMPLATE, {
    address_as: sanitizeAddressAs(addressAs),
    local_time: t.localTime,
    greeting_id: t.greetingId,
    greeting_en: t.greetingEn,
    language_rules: LANGUAGE_RULES[support],
    minutes: String(minutes),
    lesson_plan: renderLessonPlan(lesson),
    repeat_after_me: REPEAT_AFTER_ME,
    time_and_closing: TIME_AND_CLOSING,
    persona_voice: PERSONA_VOICE,
  });
}

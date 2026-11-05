import { DbDataError } from '../json';
import { migrate } from '../migrations';
import { getNextUnit, getUnit, insertUnits, listUnits, setUnitStatus, type UnitInput } from '../repos/curriculum';
import { insertMistakes, listMistakesBySession } from '../repos/mistakes';
import { getProfile, saveOnboarding, updateProfile } from '../repos/profile';
import {
  countSessions,
  getSession,
  getTranscript,
  listSessions,
  saveCallSession,
  type CallRecord,
} from '../repos/sessions';
import { getSetting, setSetting } from '../repos/settings';
import { addVocabulary, countVocabulary, listVocabulary } from '../repos/vocabulary';
import { createTestDb } from '../testing/nodeSqliteDb';
import type { SqlDatabase } from '../types';

let db: SqlDatabase;

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
});

const onboarding = {
  addressAs: '  Mas Wahyu ',
  selfAssessment: 'dasar' as const,
  goals: ['work', 'daily_conversation'],
  dailyMinutes: 15,
};

describe('profile repo', () => {
  it('returns null before onboarding', async () => {
    expect(await getProfile(db)).toBeNull();
  });

  it('saves onboarding and reads it back with defaults', async () => {
    await saveOnboarding(db, onboarding, '2026-11-05T10:00:00.000Z');
    expect(await getProfile(db)).toEqual({
      addressAs: 'Mas Wahyu',
      selfAssessment: 'dasar',
      goals: ['work', 'daily_conversation'],
      dailyMinutes: 15,
      cefrLevel: null,
      strengths: [],
      weaknesses: [],
      interests: [],
      tutorNotes: null,
      updatedAt: '2026-11-05T10:00:00.000Z',
    });
  });

  it('keeps placement data when onboarding is edited', async () => {
    await saveOnboarding(db, onboarding);
    await updateProfile(db, { cefrLevel: 'A2', weaknesses: ['past tense'], tutorNotes: 'Likes football.' });
    await saveOnboarding(db, { ...onboarding, addressAs: 'Wahyu' });
    const p = await getProfile(db);
    expect(p?.addressAs).toBe('Wahyu');
    expect(p?.cefrLevel).toBe('A2');
    expect(p?.weaknesses).toEqual(['past tense']);
    expect(p?.tutorNotes).toBe('Likes football.');
  });

  it('rejects invalid onboarding input', async () => {
    await expect(saveOnboarding(db, { ...onboarding, addressAs: '   ' })).rejects.toThrow();
    await expect(saveOnboarding(db, { ...onboarding, goals: [] })).rejects.toThrow();
  });

  it('throws DbDataError on corrupted JSON columns', async () => {
    await saveOnboarding(db, onboarding);
    await db.runAsync("UPDATE learner_profile SET goals = '{oops' WHERE id = 1", []);
    await expect(getProfile(db)).rejects.toBeInstanceOf(DbDataError);
  });
});

const call: CallRecord = {
  mode: 'free',
  unitId: null,
  startedAt: '2026-11-05T10:00:00.000Z',
  endedAt: '2026-11-05T10:05:00.000Z',
  durationSec: 300,
  endReason: 'user_hangup',
  turns: [
    { speaker: 'tutor', text: 'Hello Mas Wahyu!' },
    { speaker: 'user', text: '  ' },
    { speaker: 'user', text: 'Hello Miss Rina.' },
  ],
};

describe('sessions repo', () => {
  it('saves a call with its transcript and skips empty turns', async () => {
    const id = await saveCallSession(db, call);
    expect(await getSession(db, id)).toMatchObject({
      id,
      mode: 'free',
      durationSec: 300,
      endReason: 'user_hangup',
      hasReport: false,
      scores: null,
    });
    expect(await getTranscript(db, id)).toEqual([
      { speaker: 'tutor', text: 'Hello Mas Wahyu!' },
      { speaker: 'user', text: 'Hello Miss Rina.' },
    ]);
  });

  it('lists sessions newest first', async () => {
    const a = await saveCallSession(db, call);
    const b = await saveCallSession(db, { ...call, startedAt: '2026-11-06T10:00:00.000Z' });
    expect((await listSessions(db)).map((s) => s.id)).toEqual([b, a]);
  });

  it('rolls back the whole call if a turn is invalid', async () => {
    await expect(
      saveCallSession(db, { ...call, turns: [{ speaker: 'robot' as 'user', text: 'x' }] }),
    ).rejects.toThrow();
    expect(await listSessions(db)).toEqual([]);
  });

  it('counts sessions by mode and minimum duration', async () => {
    await saveCallSession(db, call);
    await saveCallSession(db, { ...call, durationSec: 60 });
    await saveCallSession(db, { ...call, mode: 'lesson' });
    expect(await countSessions(db, { mode: 'free' })).toBe(2);
    expect(await countSessions(db, { mode: 'free', minDurationSec: 180 })).toBe(1);
    expect(await countSessions(db, { mode: 'placement' })).toBe(0);
  });
});

const unit = (title: string): UnitInput => ({
  cefrLevel: 'A2',
  title,
  objective: 'Student can talk about last weekend.',
  objectiveId: 'Setelah pelajaran ini kamu bisa bercerita tentang akhir pekan.',
  targetVocab: [{ word: 'went', meaning_id: 'pergi (lampau)', example: 'I went to the market.' }],
  targetGrammar: [
    { pattern: 'Past simple', explanation_id: 'Dipakai untuk kejadian yang sudah selesai.', example: 'I played.' },
  ],
  scenario: 'Chatting with a friend on Monday.',
  scenarioId: 'Mengobrol dengan teman pada hari Senin.',
  isRemedial: false,
});

describe('curriculum repo', () => {
  it('inserts units in order with material and finds the next unit', async () => {
    const [a, b] = await insertUnits(db, [unit('A'), unit('B')]);
    const units = await listUnits(db);
    expect(units.map((u) => [u.title, u.position, u.status])).toEqual([
      ['A', 1, 'pending'],
      ['B', 2, 'pending'],
    ]);
    expect((await getUnit(db, a ?? -1))?.targetVocab[0]?.meaning_id).toBe('pergi (lampau)');

    await setUnitStatus(db, a ?? -1, 'done');
    expect((await getNextUnit(db))?.id).toBe(b);
  });

  it('inserts a remedial unit after a given position', async () => {
    await insertUnits(db, [unit('A'), unit('B')]);
    await insertUnits(db, [{ ...unit('R'), isRemedial: true }], { afterPosition: 1 });
    expect((await listUnits(db)).map((u) => [u.title, u.position, u.isRemedial])).toEqual([
      ['A', 1, false],
      ['R', 2, true],
      ['B', 3, false],
    ]);
  });

  it('rejects units with incomplete material', async () => {
    const bad = { ...unit('X'), targetVocab: [{ word: 'go', meaning_id: '', example: 'Go.' }] };
    await expect(insertUnits(db, [bad])).rejects.toThrow();
    expect(await listUnits(db)).toEqual([]);
  });

  it('returns null when every unit is done', async () => {
    const [a] = await insertUnits(db, [unit('A')]);
    await setUnitStatus(db, a ?? -1, 'done');
    expect(await getNextUnit(db)).toBeNull();
  });
});

describe('mistakes and vocabulary repos', () => {
  it('stores mistakes per session', async () => {
    const s = await saveCallSession(db, call);
    await insertMistakes(db, s, [
      {
        category: 'grammar',
        original: 'I go market yesterday',
        corrected: 'I went to the market yesterday',
        explanation_id: 'Pakai bentuk lampau.',
        pattern_key: 'past_tense_irregular',
      },
    ]);
    expect(await listMistakesBySession(db, s)).toMatchObject([{ sessionId: s, pattern_key: 'past_tense_irregular' }]);
  });

  it('adds vocabulary without case-insensitive duplicates', async () => {
    const s = await saveCallSession(db, call);
    expect(
      await addVocabulary(db, s, [
        { word: 'Market', meaning_id: 'pasar', example: null },
        { word: 'market', meaning_id: 'pasar', example: 'x' },
        { word: 'went', meaning_id: 'pergi', example: 'I went.' },
      ]),
    ).toBe(2);
    expect(await countVocabulary(db)).toBe(2);
    expect((await listVocabulary(db)).map((v) => v.word).sort()).toEqual(['Market', 'went']);
  });
});

describe('settings repo', () => {
  it('upserts values', async () => {
    expect(await getSetting(db, 'speed')).toBeNull();
    await setSetting(db, 'speed', 'slow');
    await setSetting(db, 'speed', 'normal');
    expect(await getSetting(db, 'speed')).toBe('normal');
  });

  it('refuses to store API keys', async () => {
    await expect(setSetting(db, 'gemini_api_key', 'x')).rejects.toThrow();
  });
});

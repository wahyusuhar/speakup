import { buildCallEndRecord, endReasonForClose } from '../callRecord';

describe('buildCallEndRecord', () => {
  it('computes ISO times and rounded duration, and strips extra turn fields', () => {
    const start = Date.UTC(2026, 10, 5, 10, 0, 0);
    const rec = buildCallEndRecord(start, start + 90_400, 'user_hangup', [
      { speaker: 'tutor', text: 'Hi', interrupted: true } as { speaker: 'tutor'; text: string },
    ]);
    expect(rec).toEqual({
      startedAt: '2026-11-05T10:00:00.000Z',
      endedAt: '2026-11-05T10:01:30.400Z',
      durationSec: 90,
      endReason: 'user_hangup',
      turns: [{ speaker: 'tutor', text: 'Hi' }],
    });
  });

  it('never returns a negative duration', () => {
    expect(buildCallEndRecord(1000, 0, 'error', []).durationSec).toBe(0);
  });
});

describe('endReasonForClose', () => {
  it.each([
    ['You exceeded your current quota', 'quota'],
    ['RESOURCE_EXHAUSTED', 'quota'],
    ['Rate limit reached', 'quota'],
    ['Internal error', 'error'],
    ['', 'error'],
  ])('%s -> %s', (reason, expected) => {
    expect(endReasonForClose(reason)).toBe(expected);
  });
});

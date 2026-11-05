// Pure helpers for describing a finished call. No I/O, so they are unit tested.

export type CallEndReason = 'user_hangup' | 'timeout' | 'error' | 'quota';

export type CallTurn = { speaker: 'user' | 'tutor'; text: string };

/** What the call hook reports when a call that reached "active" ends. Persisting it is the caller's job. */
export type CallEndRecord = {
  startedAt: string;
  endedAt: string;
  durationSec: number;
  endReason: CallEndReason;
  turns: CallTurn[];
};

export function buildCallEndRecord(
  startedAtMs: number,
  endedAtMs: number,
  endReason: CallEndReason,
  turns: readonly CallTurn[],
): CallEndRecord {
  return {
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    durationSec: Math.max(0, Math.round((endedAtMs - startedAtMs) / 1000)),
    endReason,
    turns: turns.map(({ speaker, text }) => ({ speaker, text })),
  };
}

/** Classifies an unexpected close. The docs list no codes, so match quota wording in the reason. */
export function endReasonForClose(reason: string): CallEndReason {
  return /quota|exhaust|rate.?limit|429/i.test(reason) ? 'quota' : 'error';
}

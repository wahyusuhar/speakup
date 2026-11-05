// Call hook. Phase 3 extends it into the full state machine (ARCHITECTURE.md §4):
// mute, reconnect/resumption, richer error handling.
// Platform-independent: audio comes from @/audio, storage from @/storage.
// Does not know about the database: finished calls are reported through onCallEnded.
import { useCallback, useEffect, useRef, useState } from 'react';

import { createMicStreamer } from '@/audio/MicStreamer';
import { createPcmPlayer } from '@/audio/PcmPlayer';
import { base64ToInt16, rmsInt16 } from '@/audio/pcm';
import { AudioError, type MicStreamer, type PcmPlayer } from '@/audio/types';
import { CALL_DURATION_MIN, DEFAULT_VOICE, LIVE_MODEL } from '@/config/models';
import { CALL_START_CUE } from '@/prompts/blocks';
import { apiKeyStore } from '@/storage/apiKeyStore';

import { buildCallEndRecord, endReasonForClose, type CallEndReason, type CallEndRecord } from './callRecord';
import { ResponseLatencyTracker } from './latency';
import { LiveClient } from './LiveClient';
import { LiveError, type LiveClientEvent } from './types';

export type CallStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

export type CallErrorCode =
  | 'no_api_key'
  | 'mic_permission'
  | 'mic_unavailable'
  | 'audio_unsupported'
  | 'connect_failed'
  | 'connection_lost';

export type CallError = { code: CallErrorCode; detail?: string };

export type TranscriptTurn = {
  speaker: 'user' | 'tutor';
  text: string;
  /** Seconds since the call became active when this turn's text started (0 if before). */
  atSec: number;
  interrupted?: boolean;
};

type Speaker = TranscriptTurn['speaker'];
type PendingTurn = { text: string; atSec: number };
/** Turns still being spoken (streaming transcription); empty text = none. */
export type LiveTurns = Record<Speaker, PendingTurn>;

const EMPTY_PENDING: LiveTurns = { user: { text: '', atSec: 0 }, tutor: { text: '', atSec: 0 } };

export type { CallEndRecord } from './callRecord';

export type UseLiveCallOptions = {
  /** Called once for every call that became active, however it ended. */
  onCallEnded?: (record: CallEndRecord) => void;
};

export type StartCallOptions = {
  systemInstruction: string;
  /**
   * Text turn sent once after `atSec` seconds (PROMPTS.md Blok C). A clientContent turn
   * interrupts the tutor's current generation, so it waits until the tutor is silent
   * (at most WRAP_UP_MAX_WAIT_SEC extra).
   */
  wrapUpCue?: { atSec: number; text: string };
};

const WRAP_UP_MAX_WAIT_SEC = 30;

type Session = {
  client: LiveClient;
  mic: MicStreamer;
  player: PcmPlayer;
  unsubscribe: () => void;
};

const MAX_CALL_SEC = CALL_DURATION_MIN * 60;

function audioErrorToCallError(e: unknown): CallError {
  if (e instanceof AudioError) {
    if (e.code === 'permission_denied') return { code: 'mic_permission' };
    if (e.code === 'no_device') return { code: 'mic_unavailable' };
    if (e.code === 'not_supported') return { code: 'audio_unsupported', detail: e.message };
  }
  return { code: 'audio_unsupported', detail: e instanceof Error ? e.message : undefined };
}

function liveErrorDetail(e: unknown): string | undefined {
  if (e instanceof LiveError) {
    const parts = [e.code, e.closeCode, e.closeReason].filter((p) => p !== undefined && p !== '');
    return parts.join(' · ');
  }
  return undefined;
}

export function useLiveCall(options: UseLiveCallOptions = {}) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [tutorSpeaking, setTutorSpeaking] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<CallError | null>(null);
  /** Finished turns, for on-screen display. */
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  /** Text of the turns still in progress (streaming transcription). */
  const [liveText, setLiveText] = useState<LiveTurns>(EMPTY_PENDING);
  const [muted, setMuted] = useState(false);
  /** Student mic level 0..1 (quantized), for the on-screen voice indicator. */
  const [micLevel, setMicLevel] = useState(0);
  /** Last measured response delay in ms (see ./latency.ts); null until measured. */
  const [responseDelayMs, setResponseDelayMs] = useState<number | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const endingRef = useRef(false);
  /** Set when the call becomes active; 0 means "never became active". */
  const startedAtRef = useRef(0);
  const reportedRef = useRef(false);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const pendingRef = useRef<LiveTurns>(EMPTY_PENDING);
  const tutorSpeakingRef = useRef(false);
  const mutedRef = useRef(false);
  const micLevelRef = useRef(0);
  const latencyRef = useRef(new ResponseLatencyTracker());
  const wrapUpRef = useRef<{ atSec: number; text: string; sent: boolean } | null>(null);

  const onCallEndedRef = useRef(options.onCallEnded);
  useEffect(() => {
    onCallEndedRef.current = options.onCallEnded;
  });

  const appendText = useCallback((speaker: Speaker, chunk: string) => {
    const prev = pendingRef.current[speaker];
    const startedAt = startedAtRef.current;
    const nowSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
    const atSec = prev.text === '' ? nowSec : prev.atSec;
    pendingRef.current = { ...pendingRef.current, [speaker]: { text: prev.text + chunk, atSec } };
    setLiveText(pendingRef.current);
  }, []);

  const commitTurn = useCallback((speaker: Speaker, interrupted = false) => {
    const { text: raw, atSec } = pendingRef.current[speaker];
    const text = raw.trim();
    pendingRef.current = { ...pendingRef.current, [speaker]: { text: '', atSec: 0 } };
    setLiveText(pendingRef.current);
    if (!text) return;
    const turn: TranscriptTurn = { speaker, text, atSec, interrupted };
    transcriptRef.current.push(turn);
    setTranscript((t) => [...t, turn]);
    console.log(`[transcript] ${speaker}${interrupted ? ' (terpotong)' : ''}: ${text}`);
  }, []);

  const teardown = useCallback(async () => {
    const s = sessionRef.current;
    sessionRef.current = null;
    if (!s) return;
    s.unsubscribe();
    micLevelRef.current = 0;
    setMicLevel(0);
    await s.mic.stop().catch(() => undefined);
    s.client.close();
    await s.player.close().catch(() => undefined);
    commitTurn('user');
    commitTurn('tutor');
  }, [commitTurn]);

  /** Reports the call exactly once, and only if it ever became active. */
  const reportEnd = useCallback((reason: CallEndReason) => {
    if (reportedRef.current || startedAtRef.current === 0) return;
    reportedRef.current = true;
    const record = buildCallEndRecord(startedAtRef.current, Date.now(), reason, transcriptRef.current);
    try {
      onCallEndedRef.current?.(record);
    } catch (e) {
      console.warn('[call] onCallEnded failed', e);
    }
  }, []);

  const fail = useCallback(
    async (err: CallError, reason: CallEndReason = 'error') => {
      endingRef.current = true;
      await teardown();
      reportEnd(reason);
      setTutorSpeaking(false);
      setError(err);
      setStatus('error');
    },
    [teardown, reportEnd],
  );

  const endCall = useCallback(
    async (reason: CallEndReason) => {
      endingRef.current = true;
      await teardown();
      reportEnd(reason);
      setTutorSpeaking(false);
      setStatus((s) => (s === 'error' ? s : 'ended'));
    },
    [teardown, reportEnd],
  );

  const handleEvent = useCallback(
    (event: LiveClientEvent) => {
      const s = sessionRef.current;
      if (!s) return;
      switch (event.type) {
        case 'audio': {
          const delay = latencyRef.current.onTutorAudio(Date.now());
          if (delay !== null) {
            setResponseDelayMs(delay);
            console.log(`[latency] jeda jawaban ${delay} ms`);
          }
          s.player.enqueue(event.data);
          break;
        }
        case 'interrupted':
          // Barge-in: the student started talking; stop the tutor's audio now.
          s.player.flush();
          latencyRef.current.onTutorSilent();
          commitTurn('tutor', true);
          break;
        case 'inputTranscript':
          appendText('user', event.text);
          break;
        case 'outputTranscript':
          appendText('tutor', event.text);
          break;
        case 'turnComplete':
          commitTurn('user');
          commitTurn('tutor');
          break;
        case 'goAway':
          console.warn('[live] server will close the connection soon', event.timeLeft ?? '');
          break;
        case 'error':
          console.warn('[live]', event.message);
          break;
        case 'close':
          if (!endingRef.current) {
            void fail(
              { code: 'connection_lost', detail: [event.code, event.reason].filter(Boolean).join(' · ') },
              endReasonForClose(event.reason),
            );
          }
          break;
        default:
          break;
      }
    },
    [appendText, commitTurn, fail],
  );

  /** Handles one mic chunk: level meter, latency tracking, and sending (unless muted). */
  const onMicChunk = useCallback((client: LiveClient, chunk: string) => {
    const now = Date.now();
    const rms = mutedRef.current ? 0 : rmsInt16(base64ToInt16(chunk));
    if (!tutorSpeakingRef.current) latencyRef.current.onMicLevel(now, rms);
    // Quantize so the screen re-renders only when the meter visibly changes.
    const level = Math.min(1, Math.round(Math.min(1, rms * 8) * 10) / 10);
    if (level !== micLevelRef.current) {
      micLevelRef.current = level;
      setMicLevel(level);
    }
    if (!mutedRef.current) client.sendAudio(chunk);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    // Lets automatic activity detection end the student's turn instead of waiting for more audio.
    if (next) sessionRef.current?.client.sendAudioStreamEnd();
  }, []);

  const start = useCallback(
    async ({ systemInstruction, wrapUpCue }: StartCallOptions) => {
      if (sessionRef.current) return;
      endingRef.current = false;
      wrapUpRef.current = wrapUpCue ? { ...wrapUpCue, sent: false } : null;
      tutorSpeakingRef.current = false;
      mutedRef.current = false;
      micLevelRef.current = 0;
      latencyRef.current = new ResponseLatencyTracker();
      setMuted(false);
      setMicLevel(0);
      setResponseDelayMs(null);
      startedAtRef.current = 0;
      reportedRef.current = false;
      transcriptRef.current = [];
      pendingRef.current = EMPTY_PENDING;
      setTranscript([]);
      setLiveText(EMPTY_PENDING);
      setError(null);
      setElapsedSec(0);
      setTutorSpeaking(false);
      setStatus('connecting');

      // Start audio output first, while we are still inside the user's tap.
      const player = createPcmPlayer({
        onPlayingChange: (playing) => {
          tutorSpeakingRef.current = playing;
          if (!playing) latencyRef.current.onTutorSilent();
          setTutorSpeaking(playing);
        },
      });
      try {
        await player.start();
      } catch (e) {
        await player.close().catch(() => undefined);
        return fail(audioErrorToCallError(e));
      }

      const apiKey = await apiKeyStore.getApiKey().catch(() => null);
      if (!apiKey) {
        await player.close().catch(() => undefined);
        return fail({ code: 'no_api_key' });
      }
      if (endingRef.current) {
        await player.close().catch(() => undefined);
        return;
      }

      const client = new LiveClient({ apiKey, model: LIVE_MODEL, voiceName: DEFAULT_VOICE, systemInstruction });
      const mic = createMicStreamer();
      const unsubscribe = client.on(handleEvent);
      sessionRef.current = { client, mic, player, unsubscribe };

      try {
        await client.connect();
      } catch (e) {
        if (endingRef.current) return; // user hung up while connecting
        return fail({ code: 'connect_failed', detail: liveErrorDetail(e) });
      }
      if (endingRef.current) return;

      client.sendText(CALL_START_CUE);

      try {
        await mic.start((chunk) => onMicChunk(client, chunk));
      } catch (e) {
        if (endingRef.current) return;
        return fail(audioErrorToCallError(e));
      }
      if (endingRef.current) return;

      startedAtRef.current = Date.now();
      setStatus('active');
    },
    [fail, handleEvent, onMicChunk],
  );

  const hangUp = useCallback(() => endCall('user_hangup'), [endCall]);

  // Call timer, wrap-up cue, and automatic end at CALL_DURATION_MIN.
  useEffect(() => {
    if (status !== 'active') return;
    const id = setInterval(() => {
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedSec(sec);
      if (sec >= MAX_CALL_SEC && !endingRef.current) {
        void endCall('timeout');
        return;
      }
      const cue = wrapUpRef.current;
      if (cue && !cue.sent && sec >= cue.atSec) {
        const tutorSilent = !tutorSpeakingRef.current && pendingRef.current.tutor.text === '';
        if (tutorSilent || sec >= cue.atSec + WRAP_UP_MAX_WAIT_SEC) {
          cue.sent = true;
          sessionRef.current?.client.sendText(cue.text);
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [status, endCall]);

  // Release mic/socket/audio (and still report the call) if the screen unmounts mid-call.
  useEffect(
    () => () => {
      if (endingRef.current) return;
      endingRef.current = true;
      void teardown().then(() => reportEnd('user_hangup'));
    },
    [teardown, reportEnd],
  );

  return {
    status,
    tutorSpeaking,
    elapsedSec,
    error,
    transcript,
    liveText,
    muted,
    micLevel,
    responseDelayMs,
    start,
    hangUp,
    toggleMute,
  };
}

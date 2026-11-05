// Call hook. Phase 3 extends it into the full state machine (ARCHITECTURE.md §4):
// mute, reconnect/resumption, richer error handling.
// Platform-independent: audio comes from @/audio, storage from @/storage.
// Does not know about the database: finished calls are reported through onCallEnded.
import { useCallback, useEffect, useRef, useState } from 'react';

import { createMicStreamer } from '@/audio/MicStreamer';
import { createPcmPlayer } from '@/audio/PcmPlayer';
import { AudioError, type MicStreamer, type PcmPlayer } from '@/audio/types';
import { CALL_DURATION_MIN, DEFAULT_VOICE, LIVE_MODEL } from '@/config/models';
import { CALL_START_CUE } from '@/prompts/prototypeCall';
import { apiKeyStore } from '@/storage/apiKeyStore';

import { buildCallEndRecord, endReasonForClose, type CallEndReason, type CallEndRecord } from './callRecord';
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

export type TranscriptTurn = { speaker: 'user' | 'tutor'; text: string; interrupted?: boolean };

export type { CallEndRecord } from './callRecord';

export type UseLiveCallOptions = {
  /** Called once for every call that became active, however it ended. */
  onCallEnded?: (record: CallEndRecord) => void;
};

export type StartCallOptions = {
  systemInstruction: string;
};

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
  const [liveText, setLiveText] = useState({ user: '', tutor: '' });

  const sessionRef = useRef<Session | null>(null);
  const endingRef = useRef(false);
  /** Set when the call becomes active; 0 means "never became active". */
  const startedAtRef = useRef(0);
  const reportedRef = useRef(false);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const pendingRef = useRef({ user: '', tutor: '' });

  const onCallEndedRef = useRef(options.onCallEnded);
  useEffect(() => {
    onCallEndedRef.current = options.onCallEnded;
  });

  const commitTurn = useCallback((speaker: 'user' | 'tutor', interrupted = false) => {
    const text = pendingRef.current[speaker].trim();
    pendingRef.current[speaker] = '';
    setLiveText({ ...pendingRef.current });
    if (!text) return;
    const turn: TranscriptTurn = { speaker, text, interrupted };
    transcriptRef.current.push(turn);
    setTranscript((t) => [...t, turn]);
    console.log(`[transcript] ${speaker}${interrupted ? ' (terpotong)' : ''}: ${text}`);
  }, []);

  const teardown = useCallback(async () => {
    const s = sessionRef.current;
    sessionRef.current = null;
    if (!s) return;
    s.unsubscribe();
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
        case 'audio':
          s.player.enqueue(event.data);
          break;
        case 'interrupted':
          // Barge-in: the student started talking; stop the tutor's audio now.
          s.player.flush();
          commitTurn('tutor', true);
          break;
        case 'inputTranscript':
          pendingRef.current.user += event.text;
          setLiveText({ ...pendingRef.current });
          break;
        case 'outputTranscript':
          pendingRef.current.tutor += event.text;
          setLiveText({ ...pendingRef.current });
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
    [commitTurn, fail],
  );

  const start = useCallback(
    async ({ systemInstruction }: StartCallOptions) => {
      if (sessionRef.current) return;
      endingRef.current = false;
      startedAtRef.current = 0;
      reportedRef.current = false;
      transcriptRef.current = [];
      pendingRef.current = { user: '', tutor: '' };
      setTranscript([]);
      setLiveText({ user: '', tutor: '' });
      setError(null);
      setElapsedSec(0);
      setTutorSpeaking(false);
      setStatus('connecting');

      // Start audio output first, while we are still inside the user's tap.
      const player = createPcmPlayer({ onPlayingChange: setTutorSpeaking });
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
        await mic.start((chunk) => client.sendAudio(chunk));
      } catch (e) {
        if (endingRef.current) return;
        return fail(audioErrorToCallError(e));
      }
      if (endingRef.current) return;

      startedAtRef.current = Date.now();
      setStatus('active');
    },
    [fail, handleEvent],
  );

  const hangUp = useCallback(() => endCall('user_hangup'), [endCall]);

  // Call timer + automatic end at CALL_DURATION_MIN.
  useEffect(() => {
    if (status !== 'active') return;
    const id = setInterval(() => {
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedSec(sec);
      if (sec >= MAX_CALL_SEC && !endingRef.current) void endCall('timeout');
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

  return { status, tutorSpeaking, elapsedSec, error, transcript, liveText, start, hangUp };
}

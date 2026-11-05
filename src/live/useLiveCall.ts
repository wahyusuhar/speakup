// Minimal call hook for the Phase 2 prototype. Phase 3 extends it into the full
// state machine (ARCHITECTURE.md §4): mute, timeout, resumption, error handling.
// Platform-independent: audio comes from @/audio, storage from @/storage.
import { useCallback, useEffect, useRef, useState } from 'react';

import { createMicStreamer } from '@/audio/MicStreamer';
import { createPcmPlayer } from '@/audio/PcmPlayer';
import { AudioError, type MicStreamer, type PcmPlayer } from '@/audio/types';
import { DEFAULT_VOICE, LIVE_MODEL } from '@/config/models';
import { CALL_START_CUE, PROTOTYPE_SYSTEM_PROMPT } from '@/prompts/prototypeCall';
import { apiKeyStore } from '@/storage/apiKeyStore';

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

type Session = {
  client: LiveClient;
  mic: MicStreamer;
  player: PcmPlayer;
  unsubscribe: () => void;
};

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

export function useLiveCall() {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [tutorSpeaking, setTutorSpeaking] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<CallError | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const endingRef = useRef(false);
  const startedAtRef = useRef(0);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const pendingRef = useRef({ user: '', tutor: '' });

  const commitTurn = useCallback((speaker: 'user' | 'tutor', interrupted = false) => {
    const text = pendingRef.current[speaker].trim();
    pendingRef.current[speaker] = '';
    if (!text) return;
    transcriptRef.current.push({ speaker, text, interrupted });
    // Phase 2: transcript goes to the console only (saved to DB in Phase 4).
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

  const fail = useCallback(
    async (err: CallError) => {
      endingRef.current = true;
      await teardown();
      setTutorSpeaking(false);
      setError(err);
      setStatus('error');
    },
    [teardown],
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
          break;
        case 'outputTranscript':
          pendingRef.current.tutor += event.text;
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
            void fail({ code: 'connection_lost', detail: [event.code, event.reason].filter(Boolean).join(' · ') });
          }
          break;
        default:
          break;
      }
    },
    [commitTurn, fail],
  );

  const start = useCallback(async () => {
    if (sessionRef.current) return;
    endingRef.current = false;
    transcriptRef.current = [];
    pendingRef.current = { user: '', tutor: '' };
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

    const client = new LiveClient({
      apiKey,
      model: LIVE_MODEL,
      voiceName: DEFAULT_VOICE,
      systemInstruction: PROTOTYPE_SYSTEM_PROMPT,
    });
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
  }, [fail, handleEvent]);

  const hangUp = useCallback(async () => {
    endingRef.current = true;
    await teardown();
    setTutorSpeaking(false);
    setStatus((s) => (s === 'error' ? s : 'ended'));
  }, [teardown]);

  // Call timer.
  useEffect(() => {
    if (status !== 'active') return;
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // Release mic/socket/audio if the screen unmounts mid-call.
  useEffect(
    () => () => {
      endingRef.current = true;
      void teardown();
    },
    [teardown],
  );

  return { status, tutorSpeaking, elapsedSec, error, start, hangUp };
}

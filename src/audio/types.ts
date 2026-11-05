// Platform-independent audio contracts. Implementations live in
// *.web.ts (getUserMedia + Web Audio) and *.native.ts (react-native-audio-api).
// src/live/ and the UI depend only on these types.

/** Receives one ~100 ms chunk: PCM 16-bit LE, 16 kHz, mono, base64-encoded. */
export type MicChunkHandler = (base64Pcm16k: string) => void;

export interface MicStreamer {
  /** Requests mic permission if needed, then starts emitting chunks. Rejects with AudioError. */
  start(onChunk: MicChunkHandler): Promise<void>;
  /** Stops capturing and releases the microphone. Safe to call more than once. */
  stop(): Promise<void>;
}

export interface PcmPlayer {
  /** Prepares audio output. Call from a user gesture (browsers block audio otherwise). */
  start(): Promise<void>;
  /** Queues PCM 16-bit LE, 24 kHz, mono, base64-encoded audio for gapless playback. */
  enqueue(base64Pcm24k: string): void;
  /** Stops all queued/playing audio immediately (barge-in, hang up). */
  flush(): void;
  /** Releases audio output. Safe to call more than once. */
  close(): Promise<void>;
}

export type PcmPlayerOptions = {
  /** Called when playback goes from silent to playing and back. */
  onPlayingChange?: (playing: boolean) => void;
};

export type CreateMicStreamer = () => MicStreamer;
export type CreatePcmPlayer = (options?: PcmPlayerOptions) => PcmPlayer;

export type AudioErrorCode = 'permission_denied' | 'no_device' | 'not_supported' | 'unknown';

export class AudioError extends Error {
  constructor(
    readonly code: AudioErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AudioError';
  }
}

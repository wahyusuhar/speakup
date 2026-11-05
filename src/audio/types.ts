// Platform-independent audio contracts. Implementations live in
// *.web.ts (getUserMedia + Web Audio) and *.native.ts (react-native-audio-api).
// src/live/ and the UI depend only on these types.

/** Receives one ~100 ms chunk: PCM 16-bit LE, 16 kHz, mono, base64-encoded. */
export type MicChunkHandler = (base64Pcm16k: string) => void;

export interface MicStreamer {
  /** Requests mic permission if needed, then starts emitting chunks. */
  start(onChunk: MicChunkHandler): Promise<void>;
  /** Stops capturing and releases the microphone. */
  stop(): Promise<void>;
}

export interface PcmPlayer {
  /** Queues PCM 16-bit LE, 24 kHz, mono, base64-encoded audio for gapless playback. */
  enqueue(base64Pcm24k: string): void;
  /** Stops all queued/playing audio immediately (barge-in, hang up). */
  flush(): void;
  /** Releases the audio context. */
  close(): Promise<void>;
}

export type CreateMicStreamer = () => MicStreamer;
export type CreatePcmPlayer = () => PcmPlayer;

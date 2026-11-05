// Android playback: react-native-audio-api AudioContext, 24 kHz buffers scheduled back-to-back; flush() for barge-in.
// TODO(Fase 2b): implement after the web version passes manual testing.
import { AudioError, type CreatePcmPlayer, type PcmPlayer } from './types';

class NativePcmPlayer implements PcmPlayer {
  async start(): Promise<void> {
    throw new AudioError('not_supported', 'NativePcmPlayer is not implemented yet (Fase 2b)');
  }

  enqueue(): void {}

  flush(): void {}

  async close(): Promise<void> {}
}

export const createPcmPlayer: CreatePcmPlayer = () => new NativePcmPlayer();

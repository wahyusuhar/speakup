// Android playback: react-native-audio-api AudioContext, 24 kHz buffers scheduled back-to-back; flush() for barge-in.
// TODO(Fase 2): implement.
import type { CreatePcmPlayer, PcmPlayer } from './types';

class NativePcmPlayer implements PcmPlayer {
  enqueue(): void {
    throw new Error('NativePcmPlayer is not implemented yet (Fase 2)');
  }

  flush(): void {}

  async close(): Promise<void> {}
}

export const createPcmPlayer: CreatePcmPlayer = () => new NativePcmPlayer();

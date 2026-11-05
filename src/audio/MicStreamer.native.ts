// Android mic capture: react-native-audio-api AudioRecorder -> resample 16 kHz -> Int16 -> base64.
// TODO(Fase 2): implement.
import type { CreateMicStreamer, MicStreamer } from './types';

class NativeMicStreamer implements MicStreamer {
  async start(): Promise<void> {
    throw new Error('NativeMicStreamer is not implemented yet (Fase 2)');
  }

  async stop(): Promise<void> {}
}

export const createMicStreamer: CreateMicStreamer = () => new NativeMicStreamer();

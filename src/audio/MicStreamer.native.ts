// Android mic capture: react-native-audio-api AudioRecorder -> resample 16 kHz -> Int16 -> base64.
// TODO(Fase 2b): implement after the web version passes manual testing.
import { AudioError, type CreateMicStreamer, type MicStreamer } from './types';

class NativeMicStreamer implements MicStreamer {
  async start(): Promise<void> {
    throw new AudioError('not_supported', 'NativeMicStreamer is not implemented yet (Fase 2b)');
  }

  async stop(): Promise<void> {}
}

export const createMicStreamer: CreateMicStreamer = () => new NativeMicStreamer();

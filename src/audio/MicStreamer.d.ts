// Type entry for the platform-specific MicStreamer.
// Metro resolves MicStreamer.web.ts on web and MicStreamer.native.ts on Android.
import type { CreateMicStreamer } from './types';

export declare const createMicStreamer: CreateMicStreamer;

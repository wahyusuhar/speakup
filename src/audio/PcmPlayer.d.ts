// Type entry for the platform-specific PcmPlayer.
// Metro resolves PcmPlayer.web.ts on web and PcmPlayer.native.ts on Android.
import type { CreatePcmPlayer } from './types';

export declare const createPcmPlayer: CreatePcmPlayer;

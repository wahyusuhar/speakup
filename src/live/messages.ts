// Pure builders/parsers for Live API messages (no I/O), so they can be unit tested.
import { MIC_MIME_TYPE } from '@/audio/pcm';

import { LiveError, ServerMessageSchema, type LiveEvent } from './types';

/** API-key endpoint (v1beta). The key is appended as the `key` query parameter. */
export const LIVE_WS_BASE_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export function buildLiveUrl(apiKey: string): string {
  return `${LIVE_WS_BASE_URL}?key=${encodeURIComponent(apiKey)}`;
}

export type SetupOptions = {
  model: string;
  systemInstruction: string;
  voiceName: string;
};

/**
 * First client message. Per the API reference, responseModalities and speechConfig
 * live in generationConfig. gemini-3.8-live supports AUDIO output only and rejects
 * thinking config / proactive_audio=false, so those are omitted.
 */
export function buildSetupMessage({ model, systemInstruction, voiceName }: SetupOptions) {
  return {
    setup: {
      model: model.startsWith('models/') ? model : `models/${model}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
      systemInstruction: { parts: [{ text: systemInstruction }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };
}

export function buildAudioMessage(base64Pcm16k: string) {
  return { realtimeInput: { audio: { data: base64Pcm16k, mimeType: MIC_MIME_TYPE } } };
}

/** Tells the server the mic stream paused (only valid with automatic activity detection). */
export function buildAudioStreamEndMessage() {
  return { realtimeInput: { audioStreamEnd: true } };
}

/** A complete user text turn; triggers a model response (e.g. the opening greeting). */
export function buildUserTextTurn(text: string) {
  return {
    clientContent: {
      turns: [{ role: 'user', parts: [{ text }] }],
      turnComplete: true,
    },
  };
}

/** Parses one raw server frame into zero or more events. Throws LiveError('protocol') on bad input. */
export function parseServerMessage(raw: string): LiveEvent[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new LiveError('protocol', 'Server message is not valid JSON');
  }
  const parsed = ServerMessageSchema.safeParse(json);
  if (!parsed.success) {
    throw new LiveError('protocol', 'Server message has an unexpected shape');
  }
  const msg = parsed.data;
  const events: LiveEvent[] = [];

  if (msg.setupComplete) events.push({ type: 'setupComplete' });

  const sc = msg.serverContent;
  if (sc) {
    if (sc.interrupted) events.push({ type: 'interrupted' });
    if (sc.inputTranscription?.text) {
      events.push({ type: 'inputTranscript', text: sc.inputTranscription.text });
    }
    for (const part of sc.modelTurn?.parts ?? []) {
      const data = part.inlineData;
      if (data && data.data && (!data.mimeType || data.mimeType.startsWith('audio/'))) {
        events.push({ type: 'audio', data: data.data });
      }
    }
    if (sc.outputTranscription?.text) {
      events.push({ type: 'outputTranscript', text: sc.outputTranscription.text });
    }
    if (sc.turnComplete) events.push({ type: 'turnComplete' });
  }

  if (msg.goAway) events.push({ type: 'goAway', timeLeft: msg.goAway.timeLeft });
  if (msg.sessionResumptionUpdate) {
    events.push({
      type: 'resumptionUpdate',
      handle: msg.sessionResumptionUpdate.newHandle,
      resumable: msg.sessionResumptionUpdate.resumable ?? false,
    });
  }
  return events;
}

// Live API message types. Field names verified against the official docs on 2026-11-05:
//   https://aistudio.google.com/api-reference/live/bidi-generate-content
//   https://aistudio.google.com/docs/live-api/capabilities
//   https://aistudio.google.com/docs/models/gemini-3.8-live (#migrating)
import { z } from 'zod';

const TranscriptionSchema = z.object({
  text: z.string().optional(),
});

const PartSchema = z.object({
  inlineData: z
    .object({
      mimeType: z.string().optional(),
      data: z.string(),
    })
    .optional(),
});

/** Server -> client message (BidiGenerateContentServerMessage). Unknown fields are ignored. */
export const ServerMessageSchema = z.object({
  setupComplete: z.object({}).optional(),
  serverContent: z
    .object({
      modelTurn: z.object({ parts: z.array(PartSchema).optional() }).optional(),
      interrupted: z.boolean().optional(),
      turnComplete: z.boolean().optional(),
      generationComplete: z.boolean().optional(),
      inputTranscription: TranscriptionSchema.optional(),
      outputTranscription: TranscriptionSchema.optional(),
    })
    .optional(),
  goAway: z.object({ timeLeft: z.string().optional() }).optional(),
  sessionResumptionUpdate: z
    .object({
      newHandle: z.string().optional(),
      resumable: z.boolean().optional(),
    })
    .optional(),
});

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

/** Normalised events produced from server messages. */
export type LiveEvent =
  | { type: 'setupComplete' }
  | { type: 'audio'; data: string }
  | { type: 'interrupted' }
  | { type: 'inputTranscript'; text: string }
  | { type: 'outputTranscript'; text: string }
  | { type: 'turnComplete' }
  | { type: 'goAway'; timeLeft?: string }
  | { type: 'resumptionUpdate'; handle?: string; resumable: boolean };

/** Events emitted by LiveClient: server events plus connection lifecycle. */
export type LiveClientEvent =
  | LiveEvent
  | { type: 'close'; code: number; reason: string }
  | { type: 'error'; message: string };

export type LiveErrorCode = 'timeout' | 'closed_before_setup' | 'socket_error' | 'protocol';

/** Errors never contain the WebSocket URL, because it carries the API key. */
export class LiveError extends Error {
  constructor(
    readonly code: LiveErrorCode,
    message: string,
    readonly closeCode?: number,
    readonly closeReason?: string,
  ) {
    super(message);
    this.name = 'LiveError';
  }
}

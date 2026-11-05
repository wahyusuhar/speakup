import {
  LIVE_WS_BASE_URL,
  buildAudioMessage,
  buildAudioStreamEndMessage,
  buildLiveUrl,
  buildSetupMessage,
  buildUserTextTurn,
  parseServerMessage,
} from '../messages';
import { LiveError } from '../types';

describe('builders', () => {
  it('builds the v1beta URL with an encoded key', () => {
    expect(buildLiveUrl('a b+c')).toBe(`${LIVE_WS_BASE_URL}?key=a%20b%2Bc`);
    expect(LIVE_WS_BASE_URL).toContain('v1beta.GenerativeService.BidiGenerateContent');
  });

  it('builds the setup message', () => {
    const msg = buildSetupMessage({ model: 'some-live-model', systemInstruction: 'Be nice.', voiceName: 'Kore' });
    expect(msg).toEqual({
      setup: {
        model: 'models/some-live-model',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
        systemInstruction: { parts: [{ text: 'Be nice.' }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });
  });

  it('does not double the models/ prefix', () => {
    const msg = buildSetupMessage({ model: 'models/x', systemInstruction: '', voiceName: 'Kore' });
    expect(msg.setup.model).toBe('models/x');
  });

  it('builds realtime audio and stream-end messages', () => {
    expect(buildAudioMessage('AAA=')).toEqual({
      realtimeInput: { audio: { data: 'AAA=', mimeType: 'audio/pcm;rate=16000' } },
    });
    expect(buildAudioStreamEndMessage()).toEqual({ realtimeInput: { audioStreamEnd: true } });
  });

  it('builds a complete user text turn', () => {
    expect(buildUserTextTurn('hi')).toEqual({
      clientContent: { turns: [{ role: 'user', parts: [{ text: 'hi' }] }], turnComplete: true },
    });
  });
});

describe('parseServerMessage', () => {
  it('parses setupComplete', () => {
    expect(parseServerMessage('{"setupComplete":{}}')).toEqual([{ type: 'setupComplete' }]);
  });

  it('extracts audio parts, transcripts and turnComplete in order', () => {
    const raw = JSON.stringify({
      serverContent: {
        inputTranscription: { text: 'I go market' },
        modelTurn: {
          parts: [
            { inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AQI=' } },
            { inlineData: { data: 'AwQ=' } },
            { inlineData: { mimeType: 'image/png', data: 'xxxx' } },
            { text: 'thinking...' },
          ],
        },
        outputTranscription: { text: 'You went to the market?' },
        turnComplete: true,
      },
      usageMetadata: { totalTokenCount: 10 },
    });
    expect(parseServerMessage(raw)).toEqual([
      { type: 'inputTranscript', text: 'I go market' },
      { type: 'audio', data: 'AQI=' },
      { type: 'audio', data: 'AwQ=' },
      { type: 'outputTranscript', text: 'You went to the market?' },
      { type: 'turnComplete' },
    ]);
  });

  it('emits interrupted', () => {
    expect(parseServerMessage('{"serverContent":{"interrupted":true}}')).toEqual([{ type: 'interrupted' }]);
  });

  it('parses goAway and session resumption updates', () => {
    expect(parseServerMessage('{"goAway":{"timeLeft":"30s"}}')).toEqual([{ type: 'goAway', timeLeft: '30s' }]);
    expect(parseServerMessage('{"sessionResumptionUpdate":{"newHandle":"h1","resumable":true}}')).toEqual([
      { type: 'resumptionUpdate', handle: 'h1', resumable: true },
    ]);
  });

  it('ignores messages with only unknown fields', () => {
    expect(parseServerMessage('{"usageMetadata":{"totalTokenCount":1}}')).toEqual([]);
  });

  it('throws LiveError on invalid JSON or shape', () => {
    expect(() => parseServerMessage('not json')).toThrow(LiveError);
    expect(() => parseServerMessage('{"serverContent":{"interrupted":"yes"}}')).toThrow(LiveError);
  });
});

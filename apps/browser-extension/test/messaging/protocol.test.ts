import { describe, expect, it } from 'vitest';

import {
  parseRuntimeMessage,
  serializeRuntimeError,
} from '../../src/messaging/protocol';

describe('runtime protocol', () => {
  it('parses valid discriminated request messages', () => {
    expect(parseRuntimeMessage({
      type: 'translate',
      providerId: 'deepseek',
      text: '你好',
      sourceLanguage: 'zh-Hans',
    })).toEqual({
      type: 'translate',
      providerId: 'deepseek',
      text: '你好',
      sourceLanguage: 'zh-Hans',
    });
    expect(parseRuntimeMessage({ type: 'test-provider', providerId: 'kimi' })).toEqual({
      type: 'test-provider',
      providerId: 'kimi',
    });
    expect(parseRuntimeMessage({ type: 'list-ollama-models' })).toEqual({
      type: 'list-ollama-models',
    });
    expect(parseRuntimeMessage({ type: 'get-active-provider' })).toEqual({
      type: 'get-active-provider',
    });
  });

  it('fails closed for unknown types and malformed payloads', () => {
    expect(parseRuntimeMessage({ type: 'delete-everything' })).toBeNull();
    expect(parseRuntimeMessage({ type: 'translate', providerId: 'unknown', text: 'x' })).toBeNull();
    expect(parseRuntimeMessage({ type: 'translate', providerId: 'kimi', text: 1 })).toBeNull();
  });

  it('serializes only the safe error contract', () => {
    const response = serializeRuntimeError({
      code: 'AUTHENTICATION_FAILED',
      userMessage: 'Check your API key.',
      retryable: false,
      cause: new Error('Bearer secret'),
      headers: { Authorization: 'Bearer secret' },
      body: { apiKey: 'secret' },
    });

    expect(response).toEqual({
      ok: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        userMessage: 'Check your API key.',
        retryable: false,
      },
    });
    expect(JSON.stringify(response)).not.toContain('secret');
    expect(JSON.stringify(response)).not.toContain('cause');
    expect(JSON.stringify(response)).not.toContain('headers');
    expect(JSON.stringify(response)).not.toContain('body');
  });
});

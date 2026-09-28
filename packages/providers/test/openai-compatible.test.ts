import { describe, expect, it, vi } from 'vitest';

import { TranslationError, type TranslationRequest } from '../../core/src/index';
import {
  createOpenAiCompatibleProvider,
  type JsonHttpClient,
  type JsonHttpResponse,
} from '../src/index';

const request: TranslationRequest = {
  text: '你好\n- 世界',
  targetLanguage: 'en',
};

function httpReturning(status: number, data?: unknown): JsonHttpClient {
  const client: JsonHttpClient = {
    async request<T>(): Promise<JsonHttpResponse<T>> {
      return { status, ...(data === undefined ? {} : { data }) } as JsonHttpResponse<T>;
    },
  };
  vi.spyOn(client, 'request');
  return client;
}

function provider(http: JsonHttpClient, apiKey = 'top-secret', model = 'chat-model') {
  return createOpenAiCompatibleProvider({
    id: 'deepseek',
    url: 'https://api.example.test/chat/completions',
    apiKey,
    model,
    http,
  });
}

describe('createOpenAiCompatibleProvider', () => {
  it('sends a non-streaming low-randomness request with source text only in a distinct user message', async () => {
    const http = httpReturning(200, {
      choices: [{ message: { content: 'Hello\n- World' } }],
    });
    const translationProvider = provider(http);

    await expect(translationProvider.translate(request)).resolves.toEqual({
      text: 'Hello\n- World',
      providerId: 'deepseek',
    });

    expect(http.request).toHaveBeenCalledWith({
      url: 'https://api.example.test/chat/completions',
      method: 'POST',
      headers: {
        Authorization: 'Bearer top-secret',
      },
      body: {
        model: 'chat-model',
        messages: [
          {
            role: 'system',
            content:
              'Translate the user-provided text into English only. Output only the translation. Do not answer questions, explain, add commentary, or wrap the output. Preserve Markdown, code fences, variables, URLs, lists, names, and line breaks.',
          },
          { role: 'user', content: '你好\n- 世界' },
        ],
        temperature: 0,
        stream: false,
      },
      signal: undefined,
    });
  });

  it.each([401, 403])('maps HTTP %s to a safe authentication error', async (status) => {
    const http = httpReturning(status, {
      error: { message: 'top-secret: raw credential rejected' },
    });

    const error = await provider(http).translate(request).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TranslationError);
    expect(error).toMatchObject({
      code: 'AUTHENTICATION_FAILED',
      retryable: false,
    });
    expect(String(error)).not.toContain('top-secret');
    expect(String(error)).not.toContain('raw credential rejected');
  });

  it('maps HTTP 429 to a retryable rate-limit error', async () => {
    const error = await provider(httpReturning(429)).translate(request).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'RATE_LIMITED', retryable: true });
  });

  it('maps an aborted request to a retryable timeout error', async () => {
    const http: JsonHttpClient = {
      request: vi.fn(async () => {
        throw new DOMException('request contained top-secret', 'AbortError');
      }),
    };

    const error = await provider(http).translate(request).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'TIMEOUT', retryable: true });
    expect(String(error)).not.toContain('top-secret');
  });

  it('maps fetch failures to a safe retryable network error', async () => {
    const http: JsonHttpClient = {
      request: vi.fn(async () => {
        throw new TypeError('fetch failed with top-secret');
      }),
    };

    const error = await provider(http).translate(request).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
    expect(String(error)).not.toContain('top-secret');
  });

  it('sanitizes TranslationError details thrown by the injected HTTP client', async () => {
    const http: JsonHttpClient = {
      request: vi.fn(async () => {
        throw new TranslationError({
          code: 'AUTHENTICATION_FAILED',
          userMessage: 'Bearer fake-secret-key was rejected: raw-body-details',
          retryable: false,
          cause: new Error('headers included fake-secret-key'),
        });
      }),
    };

    const error = await provider(http).translate(request).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
    expect(String(error)).not.toContain('fake-secret-key');
    expect(String(error)).not.toContain('raw-body-details');
    expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
  });

  it.each([
    {},
    { choices: [] },
    { choices: [{ message: {} }] },
    { choices: [{ message: { content: '' } }] },
    { choices: [{ message: { content: '  \n\t ' } }] },
  ])('rejects malformed successful content without exposing the response body', async (data) => {
    const error = await provider(httpReturning(200, data)).translate(request).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'MALFORMED_RESPONSE', retryable: false });
    expect(String(error)).not.toContain(JSON.stringify(data));
  });

  it.each([
    ['', 'chat-model'],
    ['   ', 'chat-model'],
    ['top-secret', ''],
    ['top-secret', '   '],
  ])('constructs without side effects but rejects blank configuration at use time', async (apiKey, model) => {
    const http = httpReturning(200, {
      choices: [{ message: { content: 'Hello' } }],
    });
    const translationProvider = provider(http, apiKey, model);

    await expect(translationProvider.translate(request)).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
    });
    await expect(translationProvider.testConnection?.()).resolves.toMatchObject({
      ok: false,
      error: { code: 'PROVIDER_NOT_CONFIGURED' },
    });
    expect(http.request).not.toHaveBeenCalled();
  });

  it('reports a successful connection test after receiving valid content', async () => {
    const translationProvider = provider(
      httpReturning(200, { choices: [{ message: { content: 'Hello' } }] }),
    );

    await expect(translationProvider.testConnection?.()).resolves.toEqual({
      ok: true,
      detail: 'Connection successful.',
    });
  });
});

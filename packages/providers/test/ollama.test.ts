import { describe, expect, it } from 'vitest';

import { TranslationError, type TranslationRequest } from '../../core/src/index';
import {
  createOllamaProvider,
  listOllamaModels,
  OLLAMA_BASE_URL,
  type JsonHttpClient,
  type JsonHttpRequest,
  type JsonHttpResponse,
} from '../src/index';

const translationRequest: TranslationRequest = {
  text: '你好\n- 世界',
  sourceLanguage: 'zh',
  targetLanguage: 'en',
};

function recordingHttpClient(
  respond: (request: JsonHttpRequest) => JsonHttpResponse<unknown> | Promise<JsonHttpResponse<unknown>>,
): { http: JsonHttpClient; requests: JsonHttpRequest[] } {
  const requests: JsonHttpRequest[] = [];
  const http: JsonHttpClient = {
    async request<T>(request: JsonHttpRequest): Promise<JsonHttpResponse<T>> {
      requests.push(request);
      return (await respond(request)) as JsonHttpResponse<T>;
    },
  };
  return { http, requests };
}

describe('listOllamaModels', () => {
  it('normalizes, de-duplicates, and sorts locally installed model names', async () => {
    const signal = new AbortController().signal;
    const { http, requests } = recordingHttpClient(() => ({
      status: 200,
      data: {
        models: [
          { name: ' zeta:latest ' },
          { name: 'alpha:7b' },
          { name: 'alpha:7b' },
          { name: '   ' },
          { name: 42 },
          { name: 'beta:3b' },
        ],
      },
    }));

    await expect(listOllamaModels(http, signal)).resolves.toEqual([
      'alpha:7b',
      'beta:3b',
      'zeta:latest',
    ]);
    expect(requests).toEqual([
      {
        url: 'http://localhost:11434/api/tags',
        method: 'GET',
        signal,
      },
    ]);
  });

  it.each([{}, { models: null }, { models: 'not-an-array' }])(
    'rejects a malformed model-list response without exposing its body',
    async (data) => {
      const { http } = recordingHttpClient(() => ({ status: 200, data }));

      const error = await listOllamaModels(http).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(TranslationError);
      expect(error).toMatchObject({ code: 'MALFORMED_RESPONSE', retryable: false });
      expect(String(error)).not.toContain(JSON.stringify(data));
    },
  );
});

describe('createOllamaProvider', () => {
  it('normalizes the selected model and sends a non-streaming localhost chat request', async () => {
    const signal = new AbortController().signal;
    const { http, requests } = recordingHttpClient(() => ({
      status: 200,
      data: { message: { role: 'assistant', content: 'Hello\n- World' }, done: true },
    }));
    const provider = createOllamaProvider({ model: '  llama3.2:3b  ', http });

    await expect(provider.translate(translationRequest, { signal })).resolves.toEqual({
      text: 'Hello\n- World',
      providerId: 'ollama',
      sourceLanguage: 'zh',
    });
    expect(requests).toEqual([
      {
        url: 'http://localhost:11434/api/chat',
        method: 'POST',
        body: {
          model: 'llama3.2:3b',
          messages: [
            {
              role: 'system',
              content:
                'Translate the user-provided text into English only. Output only the translation. Do not answer questions, explain, add commentary, or wrap the output. Preserve Markdown, code fences, variables, URLs, lists, names, and line breaks.',
            },
            { role: 'user', content: '你好\n- 世界' },
          ],
          stream: false,
        },
        signal,
      },
    ]);
  });

  it.each(['', '   ', '\n\t'])('rejects a blank selected model without making a request', async (model) => {
    const { http, requests } = recordingHttpClient(() => ({ status: 200 }));
    const provider = createOllamaProvider({ model, http });

    await expect(provider.availability()).resolves.toEqual({ status: 'unavailable' });
    await expect(provider.translate(translationRequest)).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
      retryable: false,
    });
    await expect(provider.testConnection?.()).resolves.toMatchObject({
      ok: false,
      error: { code: 'PROVIDER_NOT_CONFIGURED', retryable: false },
    });
    expect(requests).toEqual([]);
  });

  it('maps unreachable Ollama calls to safe retryable service errors', async () => {
    const { http } = recordingHttpClient(() => {
      throw new TypeError('connect ECONNREFUSED; leaked-local-detail');
    });
    const provider = createOllamaProvider({ model: 'llama3.2:3b', http });

    const listError = await listOllamaModels(http).catch((caught: unknown) => caught);
    const translateError = await provider.translate(translationRequest).catch((caught: unknown) => caught);

    for (const error of [listError, translateError]) {
      expect(error).toBeInstanceOf(TranslationError);
      expect(error).toMatchObject({ code: 'OLLAMA_UNAVAILABLE', retryable: true });
      expect(String(error)).not.toContain('leaked-local-detail');
      expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
    }
  });

  it('maps an aborted request to a safe retryable timeout error', async () => {
    const { http } = recordingHttpClient(() => {
      throw new DOMException('leaked-abort-detail', 'AbortError');
    });

    const error = await createOllamaProvider({ model: 'llama3.2:3b', http })
      .translate(translationRequest)
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'TIMEOUT', retryable: true });
    expect(String(error)).not.toContain('leaked-abort-detail');
  });

  it('maps an AbortSignal timeout to a safe retryable timeout error', async () => {
    const { http } = recordingHttpClient(() => {
      throw new DOMException('leaked-timeout-detail', 'TimeoutError');
    });

    const error = await createOllamaProvider({ model: 'llama3.2:3b', http })
      .translate(translationRequest)
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'TIMEOUT', retryable: true });
    expect(String(error)).not.toContain('leaked-timeout-detail');
  });

  it('maps a missing selected model to a safe non-retryable model error', async () => {
    const { http } = recordingHttpClient(() => ({
      status: 404,
      data: { error: 'model llama3.2:3b not found; leaked-daemon-detail' },
    }));

    const error = await createOllamaProvider({ model: 'llama3.2:3b', http })
      .translate(translationRequest)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TranslationError);
    expect(error).toMatchObject({ code: 'MODEL_NOT_FOUND', retryable: false });
    expect(String(error)).not.toContain('leaked-daemon-detail');
  });

  it.each([
    {},
    { message: null },
    { message: {} },
    { message: { content: 42 } },
    { message: { content: '' } },
    { message: { content: ' \n\t ' } },
  ])('rejects malformed successful chat content without exposing the response body', async (data) => {
    const { http } = recordingHttpClient(() => ({ status: 200, data }));

    const error = await createOllamaProvider({ model: 'llama3.2:3b', http })
      .translate(translationRequest)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TranslationError);
    expect(error).toMatchObject({ code: 'MALFORMED_RESPONSE', retryable: false });
    expect(String(error)).not.toContain(JSON.stringify(data));
  });

  it('never sends model discovery or translation requests outside localhost:11434', async () => {
    const { http, requests } = recordingHttpClient((request) =>
      request.url.endsWith('/api/tags')
        ? { status: 200, data: { models: [] } }
        : { status: 200, data: { message: { content: 'Hello' } } },
    );

    await listOllamaModels(http);
    await createOllamaProvider({ model: 'llama3.2:3b', http }).translate(translationRequest);

    expect(OLLAMA_BASE_URL).toBe('http://localhost:11434');
    expect(requests).toHaveLength(2);
    expect(requests.every(({ url }) => new URL(url).host === 'localhost:11434')).toBe(true);
  });
});

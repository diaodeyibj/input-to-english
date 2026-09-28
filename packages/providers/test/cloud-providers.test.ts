import { describe, expect, it, vi } from 'vitest';

import type { JsonHttpClient, JsonHttpResponse } from '../src/index';
import { createDeepSeekProvider, createKimiProvider } from '../src/index';

function successfulHttpClient(): JsonHttpClient {
  const client: JsonHttpClient = {
    async request<T>(): Promise<JsonHttpResponse<T>> {
      return {
        status: 200,
        data: { choices: [{ message: { content: 'Hello' } }] } as T,
      };
    },
  };
  vi.spyOn(client, 'request');
  return client;
}

describe('cloud provider factories', () => {
  it.each([
    {
      name: 'DeepSeek',
      create: createDeepSeekProvider,
      expected: {
        id: 'deepseek',
        url: 'https://api.deepseek.com/chat/completions',
        model: 'deepseek-flash',
      },
    },
    {
      name: 'Kimi',
      create: createKimiProvider,
      expected: {
        id: 'kimi',
        url: 'https://api.moonshot.cn/v1/chat/completions',
        model: 'kimi-k2.6',
      },
    },
  ])('$name uses its endpoint, default model, bearer credentials, and provider ID', async ({ create, expected }) => {
    const http = successfulHttpClient();
    const provider = create({ apiKey: 'factory-test-key', http });

    expect(provider.id).toBe(expected.id);
    await expect(provider.translate({ text: '你好', targetLanguage: 'en' })).resolves.toEqual({
      text: 'Hello',
      providerId: expected.id,
    });
    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expected.url,
        headers: { Authorization: 'Bearer factory-test-key' },
        body: expect.objectContaining({ model: expected.model, stream: false }),
      }),
    );
  });

  it('uses non-thinking DeepSeek for translation and connection checks', async () => {
    const http = successfulHttpClient();
    const provider = createDeepSeekProvider({ apiKey: 'factory-test-key', http });

    await provider.translate({ text: '你好', targetLanguage: 'en' });
    await expect(provider.testConnection?.()).resolves.toMatchObject({ ok: true });

    expect(http.request).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(http.request).mock.calls) {
      expect(call[0].body).toMatchObject({
        model: 'deepseek-flash',
        thinking: { type: 'disabled' },
        temperature: 0,
        stream: false,
      });
    }
  });

  it('sends valid non-thinking Kimi K2.6 parameters for translation and connection checks', async () => {
    const http = successfulHttpClient();
    const provider = createKimiProvider({ apiKey: 'factory-test-key', http });

    await provider.translate({ text: '你好', targetLanguage: 'en' });
    await expect(provider.testConnection?.()).resolves.toMatchObject({ ok: true });

    expect(http.request).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(http.request).mock.calls) {
      expect(call[0].body).toMatchObject({
        model: 'kimi-k2.6',
        thinking: { type: 'disabled' },
        stream: false,
      });
      expect(call[0].body).not.toHaveProperty('temperature');
    }
  });
});

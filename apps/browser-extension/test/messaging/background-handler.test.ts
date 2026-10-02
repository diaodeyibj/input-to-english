import { describe, expect, it, vi } from 'vitest';

import type { JsonHttpClient, JsonHttpRequest } from '../../../../packages/providers/src/index';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '../../src/storage/settings';
import { handleRuntimeMessage } from '../../src/messaging/background-handler';

function setup(
  request: (input: JsonHttpRequest) => Promise<{ status: number; data?: unknown }>,
  overrides: Partial<ExtensionSettings> = {},
) {
  const settings: ExtensionSettings = {
    ...DEFAULT_SETTINGS,
    deepseek: { apiKey: 'deepseek-test-key', model: 'deepseek-test-model' },
    kimi: { apiKey: 'kimi-test-key', model: 'kimi-test-model' },
    ...overrides,
  };
  const get = vi.fn(async () => settings);
  const http = { request: vi.fn(request) } as JsonHttpClient;
  return { settings: { get }, http };
}

describe('background runtime handler', () => {
  it('returns only the active provider ID to content without credentials or models', async () => {
    const dependencies = setup(async () => { throw new Error('HTTP should not run'); }, {
      activeProvider: 'kimi',
    });
    const response = await handleRuntimeMessage({ type: 'get-active-provider' }, dependencies);
    expect(response).toEqual({ ok: true, type: 'get-active-provider', activeProvider: 'kimi' });
    expect(JSON.stringify(response)).not.toContain('test-key');
    expect(dependencies.http.request).not.toHaveBeenCalled();
  });

  it('uses the requested remote provider even when a different provider is active', async () => {
    const dependencies = setup(async ({ url, headers, signal }) => {
      expect(url).toBe('https://api.moonshot.cn/v1/chat/completions');
      expect(headers?.Authorization).toBe('Bearer kimi-test-key');
      expect(signal).toBeInstanceOf(AbortSignal);
      return { status: 200, data: { choices: [{ message: { content: 'Hello' } }] } };
    }, { activeProvider: 'deepseek' });

    expect(await handleRuntimeMessage({
      type: 'translate', providerId: 'kimi', text: '你好', sourceLanguage: 'zh-Hans',
    }, dependencies)).toEqual({
      ok: true,
      type: 'translate',
      result: { text: 'Hello', providerId: 'kimi', sourceLanguage: 'zh-Hans' },
    });
    expect(dependencies.http.request).toHaveBeenCalledTimes(1);
  });

  it('does not call a second provider after the selected provider fails', async () => {
    const dependencies = setup(async () => ({ status: 401 }));
    const response = await handleRuntimeMessage({
      type: 'translate', providerId: 'deepseek', text: '你好',
    }, dependencies);
    expect(response).toEqual({
      ok: false,
      error: { code: 'AUTHENTICATION_FAILED', userMessage: 'Authentication failed.', retryable: false },
    });
    expect(dependencies.http.request).toHaveBeenCalledTimes(1);
    expect(vi.mocked(dependencies.http.request).mock.calls[0]?.[0].url)
      .toBe('https://api.deepseek.com/chat/completions');
  });

  it('runs connection checks and returns a typed result', async () => {
    const dependencies = setup(async () => ({
      status: 200, data: { choices: [{ message: { content: 'Hello' } }] },
    }));
    expect(await handleRuntimeMessage({ type: 'test-provider', providerId: 'deepseek' }, dependencies))
      .toEqual({ ok: true, type: 'test-provider', result: { ok: true, detail: 'Connection successful.' } });
  });

  it('aborts a connection check at the same deadline as translation', async () => {
    vi.useFakeTimers();
    try {
      let operationSignal: AbortSignal | undefined;
      const dependencies = setup(async ({ signal }) => {
        operationSignal = signal;
        return new Promise(() => undefined);
      });
      const pending = handleRuntimeMessage({ type: 'test-provider', providerId: 'deepseek' }, dependencies);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await pending).toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
      expect(operationSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects malformed and browser-provider messages without loading settings', async () => {
    const dependencies = setup(async () => { throw new Error('unexpected request'); });
    for (const message of [
      { type: 'unexpected' },
      { type: 'translate', providerId: 'kimi', text: 1 },
      { type: 'translate', providerId: 'browser', text: '你好' },
      { type: 'test-provider', providerId: 'browser' },
    ]) {
      const response = await handleRuntimeMessage(message, dependencies);
      expect(response).toMatchObject({ ok: false, error: { code: 'UNKNOWN' } });
    }
    expect(dependencies.settings.get).not.toHaveBeenCalled();
    expect(dependencies.http.request).not.toHaveBeenCalled();
  });

  it('serializes storage failures without exposing credentials or raw errors', async () => {
    const dependencies = setup(async () => ({ status: 200 }));
    dependencies.settings.get.mockRejectedValueOnce(new Error('Bearer secret-storage-key'));
    const response = await handleRuntimeMessage({ type: 'translate', providerId: 'deepseek', text: '你好' }, dependencies);
    expect(response).toMatchObject({ ok: false, error: { code: 'UNKNOWN', retryable: false } });
    expect(JSON.stringify(response)).not.toContain('secret-storage-key');
    expect(JSON.stringify(response)).not.toContain('cause');
  });

  it.each(['translate', 'test-provider'] as const)(
    'times out when settings.get hangs before %s',
    async (type) => {
      vi.useFakeTimers();
      try {
        const dependencies = setup(async () => { throw new Error('HTTP should not run'); });
        let finishSettings!: (settings: ExtensionSettings) => void;
        dependencies.settings.get.mockImplementationOnce(() => new Promise((resolve) => {
          finishSettings = resolve;
        }));
        const message = type === 'translate'
          ? { type, providerId: 'kimi', text: '你好' }
          : { type, providerId: 'kimi' };
        const pending = handleRuntimeMessage(message, dependencies);
        await vi.advanceTimersByTimeAsync(30_000);
        expect(await pending).toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
        finishSettings(DEFAULT_SETTINGS);
        await Promise.resolve();
        expect(dependencies.http.request).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('settles a timed-out request without returning a late result', async () => {
    vi.useFakeTimers();
    try {
      let complete!: (value: { status: number; data: unknown }) => void;
      const dependencies = setup(() => new Promise((resolve) => { complete = resolve; }));
      const pending = handleRuntimeMessage({ type: 'translate', providerId: 'kimi', text: '你好' }, dependencies);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await pending).toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
      complete({ status: 200, data: { choices: [{ message: { content: 'late' } }] } });
      await Promise.resolve();
    } finally {
      vi.useRealTimers();
    }
  });
});

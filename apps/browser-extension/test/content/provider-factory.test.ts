import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '../../src/storage/settings';
import {
  createActiveProvider,
  createConfiguredProvider,
  createDocumentBrowserBridges,
} from '../../src/content/provider-factory';

describe('content provider factory', () => {
  it('uses the current background selection for each translation without reading storage', async () => {
    let activeProvider = 'deepseek';
    const sendMessage = vi.fn(async (message: { type: string; providerId?: string }) => {
      if (message.type === 'get-active-provider') {
        return { ok: true, type: 'get-active-provider', activeProvider };
      }
      return {
        ok: true, type: 'translate',
        result: { text: message.providerId, providerId: message.providerId },
      };
    });
    const provider = createActiveProvider({ runtimeClient: { sendMessage } });

    expect(await provider.translate({ text: '你好', targetLanguage: 'en' }))
      .toEqual({ text: 'deepseek', providerId: 'deepseek' });
    activeProvider = 'kimi';
    expect(await provider.translate({ text: 'Bonjour', targetLanguage: 'en' }))
      .toEqual({ text: 'kimi', providerId: 'kimi' });
    expect(sendMessage.mock.calls.map(([message]) => message.type)).toEqual([
      'get-active-provider', 'translate', 'get-active-provider', 'translate',
    ]);
  });

  it.each(['deepseek', 'kimi', 'ollama'] as const)('routes %s through only its runtime proxy', async (id) => {
    const sendMessage = vi.fn(async () => ({
      ok: true, type: 'translate', result: { text: 'Hello', providerId: id },
    }));
    const provider = createConfiguredProvider(
      { ...DEFAULT_SETTINGS, activeProvider: id },
      { runtimeClient: { sendMessage } },
    );

    expect(provider.id).toBe(id);
    expect(await provider.translate({ text: '你好', targetLanguage: 'en' }))
      .toEqual({ text: 'Hello', providerId: id });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'translate', providerId: id, text: '你好' });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('never falls back after the configured runtime provider fails', async () => {
    const sendMessage = vi.fn(async () => ({
      ok: false,
      error: { code: 'RATE_LIMITED', userMessage: 'Rate limited.', retryable: true },
    }));
    const provider = createConfiguredProvider(
      { ...DEFAULT_SETTINGS, activeProvider: 'deepseek' },
      { runtimeClient: { sendMessage } },
    );

    await expect(provider.translate({ text: '你好', targetLanguage: 'en' }))
      .rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ type: 'translate', providerId: 'deepseek', text: '你好' });
  });

  it('uses only the browser-local provider for browser selection', async () => {
    const sendMessage = vi.fn();
    const provider = createConfiguredProvider(DEFAULT_SETTINGS, {
      runtimeClient: { sendMessage },
      detector: { detect: async () => ({ detectedLanguage: 'zh', confidence: 0.99 }) },
      translator: {
        availability: async () => 'available',
        translate: async () => 'Hello',
      },
    });

    expect(provider.id).toBe('browser');
    expect(await provider.translate({ text: '你好', targetLanguage: 'en' }))
      .toEqual({ text: 'Hello', providerId: 'browser', sourceLanguage: 'zh' });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('reports missing document APIs through the browser-local bridge', async () => {
    const bridges = createDocumentBrowserBridges({});
    const provider = createConfiguredProvider(DEFAULT_SETTINGS, {
      runtimeClient: { sendMessage: vi.fn() }, ...bridges,
    });

    await expect(provider.translate({ text: '你好', targetLanguage: 'en' }))
      .rejects.toMatchObject({ code: 'BROWSER_API_UNAVAILABLE' });
  });
});

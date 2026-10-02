import { describe, expect, it, vi } from 'vitest';

import { createRuntimeProvider, getActiveProvider } from '../../src/messaging/runtime-provider';

describe('runtime provider proxy', () => {
  it('reads only the active provider ID and rejects malformed background replies', async () => {
    const sendMessage = vi.fn(async (): Promise<unknown> => ({
      ok: true, type: 'get-active-provider', activeProvider: 'deepseek', apiKey: 'secret',
    }));
    expect(await getActiveProvider({ sendMessage })).toBe('deepseek');
    expect(sendMessage).toHaveBeenCalledWith({ type: 'get-active-provider' });
    sendMessage.mockResolvedValueOnce({ ok: true, type: 'get-active-provider', activeProvider: 'evil' });
    await expect(getActiveProvider({ sendMessage }))
      .rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });
  });

  it('retries one failed read of the selected provider while the worker reconnects', async () => {
    const sendMessage = vi.fn().mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.'))
      .mockResolvedValueOnce({ ok: true, type: 'get-active-provider', activeProvider: 'browser' });
    expect(await getActiveProvider({ sendMessage })).toBe('browser');
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls.every(([message]) => message.type === 'get-active-provider')).toBe(true);
  });

  it('asks for page refresh on invalidated extension context without retrying', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('Extension context invalidated.'));
    await expect(getActiveProvider({ sendMessage })).rejects.toMatchObject({
      code: 'NETWORK_ERROR', retryable: false,
      userMessage: expect.stringContaining('Refresh this page'),
    });
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it('stops after one read retry and explains how to restore the connection', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('Receiving end does not exist.'));
    await expect(getActiveProvider({ sendMessage })).rejects.toMatchObject({
      code: 'NETWORK_ERROR', userMessage: expect.stringContaining('Refresh this page'),
    });
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('never retries a translation that may already have reached the provider', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('The message port closed before a response was received.'));
    const provider = createRuntimeProvider('kimi', { sendMessage });
    await expect(provider.translate({ text: '你好', targetLanguage: 'en' })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it('maps a translation request and result without sending credentials', async () => {
    const sendMessage = vi.fn(async () => ({
      ok: true, type: 'translate', result: { text: 'Hello', providerId: 'kimi' },
    }));
    const provider = createRuntimeProvider('kimi', { sendMessage });
    expect(await provider.translate({ text: '你好', targetLanguage: 'en' }))
      .toEqual({ text: 'Hello', providerId: 'kimi' });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'translate', providerId: 'kimi', text: '你好' });
    expect(JSON.stringify(sendMessage.mock.calls)).not.toContain('apiKey');
  });

  it('maps connection test and availability to the remote proxy', async () => {
    const sendMessage = vi.fn(async () => ({
      ok: true, type: 'test-provider', result: { ok: true, detail: 'Connection successful.' },
    }));
    const provider = createRuntimeProvider('deepseek', { sendMessage });
    expect(await provider.availability()).toEqual({ status: 'available' });
    expect(await provider.testConnection?.()).toEqual({ ok: true, detail: 'Connection successful.' });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'test-provider', providerId: 'deepseek' });
  });

  it('preserves structured provider codes without retaining extra error fields', async () => {
    const provider = createRuntimeProvider('deepseek', {
      sendMessage: async () => ({
        ok: false,
        error: {
          code: 'RATE_LIMITED', userMessage: 'The provider rate limit was reached.', retryable: true,
          headers: { Authorization: 'Bearer secret-token' },
        },
      }),
    });
    const error = await provider.translate({ text: '你好', targetLanguage: 'en' })
      .then(() => null, (reason: unknown) => reason);
    expect(error).toMatchObject({ code: 'RATE_LIMITED', retryable: true });
    expect(JSON.stringify(error)).not.toContain('secret-token');
    expect((error as Error).cause).toBeUndefined();
  });

  it('rejects a mismatched or malformed runtime success response', async () => {
    const provider = createRuntimeProvider('kimi', {
      sendMessage: async () => ({ ok: true, type: 'get-active-provider', activeProvider: 'kimi' }),
    });
    await expect(provider.translate({ text: '你好', targetLanguage: 'en' }))
      .rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });
  });
});

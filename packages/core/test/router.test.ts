import { describe, expect, it, vi } from 'vitest';

import {
  TranslationError,
  TranslationRouter,
  type TranslationProvider,
} from '../src/index';

const request = { text: '你好', targetLanguage: 'en' as const };

function provider(
  id: TranslationProvider['id'],
  translate: TranslationProvider['translate'],
): TranslationProvider {
  return {
    id,
    availability: async () => ({ status: 'available' }),
    translate,
  };
}

describe('TranslationRouter', () => {
  it('invokes only the selected provider and returns its result', async () => {
    const deepseekTranslate = vi.fn(async () => ({
      text: 'hello',
      providerId: 'deepseek' as const,
    }));
    const kimiTranslate = vi.fn(async () => ({
      text: 'hello from Kimi',
      providerId: 'kimi' as const,
    }));
    const router = new TranslationRouter([
      provider('deepseek', deepseekTranslate),
      provider('kimi', kimiTranslate),
    ]);

    await expect(router.translate('deepseek', request)).resolves.toEqual({
      text: 'hello',
      providerId: 'deepseek',
    });
    expect(deepseekTranslate).toHaveBeenCalledWith(request, undefined);
    expect(kimiTranslate).not.toHaveBeenCalled();
  });

  it('does not invoke another provider when the selected provider fails', async () => {
    const failure = new TranslationError({
      code: 'NETWORK_ERROR',
      userMessage: 'Network request failed.',
      retryable: true,
    });
    const deepseekTranslate = vi.fn(async () => {
      throw failure;
    });
    const kimiTranslate = vi.fn(async () => ({
      text: 'fallback translation',
      providerId: 'kimi' as const,
    }));
    const router = new TranslationRouter([
      provider('deepseek', deepseekTranslate),
      provider('kimi', kimiTranslate),
    ]);

    await expect(router.translate('deepseek', request)).rejects.toBe(failure);
    expect(kimiTranslate).not.toHaveBeenCalled();
  });

});

import type { TranslationProvider } from '../../core/src/index';

import type { JsonHttpClient } from './http';
import { createOpenAiCompatibleProvider } from './openai-compatible';

export const DEFAULT_KIMI_MODEL = 'kimi-k2.6';

interface KimiProviderOptions {
  apiKey: string;
  model?: string;
  http: JsonHttpClient;
}

export function createKimiProvider({
  apiKey,
  model = DEFAULT_KIMI_MODEL,
  http,
}: KimiProviderOptions): TranslationProvider {
  return createOpenAiCompatibleProvider({
    id: 'kimi',
    url: 'https://api.moonshot.cn/v1/chat/completions',
    apiKey,
    model,
    http,
    requestPolicy: model === DEFAULT_KIMI_MODEL
      ? { thinking: { type: 'disabled' } }
      : {},
  });
}

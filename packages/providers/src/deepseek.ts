import type { TranslationProvider } from '../../core/src/index';

import type { JsonHttpClient } from './http';
import { createOpenAiCompatibleProvider } from './openai-compatible';

export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-flash';

interface DeepSeekProviderOptions {
  apiKey: string;
  model?: string;
  http: JsonHttpClient;
}

export function createDeepSeekProvider({
  apiKey,
  model = DEFAULT_DEEPSEEK_MODEL,
  http,
}: DeepSeekProviderOptions): TranslationProvider {
  return createOpenAiCompatibleProvider({
    id: 'deepseek',
    url: 'https://api.deepseek.com/chat/completions',
    apiKey,
    model,
    http,
  });
}

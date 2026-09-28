import {
  TranslationError,
  type ProviderId,
  type TranslationProvider,
  type TranslationRequest,
  type TranslationResult,
} from '../../core/src/index';
import { buildTranslationMessages } from '../../prompt/src/index';

import type { JsonHttpClient, JsonHttpResponse } from './http';

interface OpenAiCompatibleProviderOptions {
  id: ProviderId;
  url: string;
  apiKey: string;
  model: string;
  http: JsonHttpClient;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

function error(
  code: ConstructorParameters<typeof TranslationError>[0]['code'],
  userMessage: string,
  retryable: boolean,
): TranslationError {
  return new TranslationError({ code, userMessage, retryable });
}

function configurationError(): TranslationError {
  return error(
    'PROVIDER_NOT_CONFIGURED',
    'Configure an API key and model before using this provider.',
    false,
  );
}

function throwForStatus(status: number): void {
  if (status >= 200 && status < 300) return;
  if (status === 401 || status === 403) {
    throw error('AUTHENTICATION_FAILED', 'Authentication failed.', false);
  }
  if (status === 429) {
    throw error('RATE_LIMITED', 'The provider rate limit was reached.', true);
  }
  throw error('NETWORK_ERROR', 'The provider request failed.', status >= 500);
}

function readContent(response: JsonHttpResponse<ChatCompletionResponse>): string {
  throwForStatus(response.status);
  const content = response.data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw error('MALFORMED_RESPONSE', 'The provider returned an invalid response.', false);
  }
  return content;
}

function safeRequestError(cause: unknown): TranslationError {
  if (cause instanceof TranslationError) return cause;
  if (cause instanceof Error && cause.name === 'AbortError') {
    return error('TIMEOUT', 'The provider request timed out.', true);
  }
  return error('NETWORK_ERROR', 'The provider could not be reached.', true);
}

export function createOpenAiCompatibleProvider({
  id,
  url,
  apiKey,
  model,
  http,
}: OpenAiCompatibleProviderOptions): TranslationProvider {
  const isConfigured = () => apiKey.trim().length > 0 && model.trim().length > 0;

  const translate = async (
    request: TranslationRequest,
    signal?: AbortSignal,
  ): Promise<TranslationResult> => {
    if (!isConfigured()) throw configurationError();

    try {
      const response = await http.request<ChatCompletionResponse>({
        url,
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: {
          model,
          messages: buildTranslationMessages(request.text),
          temperature: 0,
          stream: false,
        },
        signal,
      });
      return {
        text: readContent(response),
        providerId: id,
        ...(request.sourceLanguage === undefined
          ? {}
          : { sourceLanguage: request.sourceLanguage }),
      };
    } catch (cause) {
      throw safeRequestError(cause);
    }
  };

  return {
    id,
    availability: async () => ({
      status: isConfigured() ? 'available' : 'unavailable',
    }),
    testConnection: async () => {
      if (!isConfigured()) return { ok: false, error: configurationError() };
      try {
        await translate({ text: '测试', targetLanguage: 'en' });
        return { ok: true, detail: 'Connection successful.' };
      } catch (cause) {
        return { ok: false, error: safeRequestError(cause) };
      }
    },
    translate: (request, options) => translate(request, options?.signal),
  };
}

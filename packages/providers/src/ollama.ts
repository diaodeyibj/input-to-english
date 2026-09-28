import {
  TranslationError,
  type TranslationProvider,
  type TranslationRequest,
  type TranslationResult,
} from '../../core/src/index';
import { buildTranslationMessages } from '../../prompt/src/index';

import type { JsonHttpClient, JsonHttpResponse } from './http';

export const OLLAMA_BASE_URL = 'http://localhost:11434';

const OLLAMA_TAGS_URL = `${OLLAMA_BASE_URL}/api/tags`;
const OLLAMA_CHAT_URL = `${OLLAMA_BASE_URL}/api/chat`;

interface OllamaProviderOptions {
  model: string;
  http: JsonHttpClient;
}

interface OllamaTagsResponse {
  models?: unknown;
}

interface OllamaChatResponse {
  message?: {
    content?: unknown;
  } | null;
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
    'Select an installed Ollama model before using this provider.',
    false,
  );
}

function malformedResponseError(): TranslationError {
  return error('MALFORMED_RESPONSE', 'Ollama returned an invalid response.', false);
}

function requestError(cause: unknown): TranslationError {
  if (cause instanceof Error && cause.name === 'AbortError') {
    return error('TIMEOUT', 'The Ollama request timed out.', true);
  }
  return error('OLLAMA_UNAVAILABLE', 'Ollama is unavailable on this device.', true);
}

function throwForListStatus(status: number): void {
  if (status >= 200 && status < 300) return;
  throw error('OLLAMA_UNAVAILABLE', 'Ollama is unavailable on this device.', true);
}

function throwForChatStatus(status: number): void {
  if (status >= 200 && status < 300) return;
  if (status === 404) {
    throw error('MODEL_NOT_FOUND', 'The selected Ollama model is not installed.', false);
  }
  throw error('OLLAMA_UNAVAILABLE', 'Ollama could not complete the request.', status >= 500);
}

function normalizeModelNames(response: JsonHttpResponse<OllamaTagsResponse>): string[] {
  throwForListStatus(response.status);
  if (!Array.isArray(response.data?.models)) throw malformedResponseError();

  const names = response.data.models.flatMap((model) => {
    if (typeof model !== 'object' || model === null || !('name' in model)) return [];
    const name = (model as { name?: unknown }).name;
    if (typeof name !== 'string') return [];
    const normalized = name.trim();
    return normalized.length === 0 ? [] : [normalized];
  });

  return [...new Set(names)].sort((left, right) => left.localeCompare(right));
}

function readContent(response: JsonHttpResponse<OllamaChatResponse>): string {
  throwForChatStatus(response.status);
  const content = response.data?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw malformedResponseError();
  }
  return content;
}

export async function listOllamaModels(
  http: JsonHttpClient,
  signal?: AbortSignal,
): Promise<string[]> {
  let response: JsonHttpResponse<OllamaTagsResponse>;
  try {
    response = await http.request<OllamaTagsResponse>({
      url: OLLAMA_TAGS_URL,
      method: 'GET',
      signal,
    });
  } catch (cause) {
    throw requestError(cause);
  }
  return normalizeModelNames(response);
}

export function createOllamaProvider({ model, http }: OllamaProviderOptions): TranslationProvider {
  const normalizedModel = model.trim();
  const isConfigured = () => normalizedModel.length > 0;

  const translate = async (
    request: TranslationRequest,
    signal?: AbortSignal,
  ): Promise<TranslationResult> => {
    if (!isConfigured()) throw configurationError();

    let response: JsonHttpResponse<OllamaChatResponse>;
    try {
      response = await http.request<OllamaChatResponse>({
        url: OLLAMA_CHAT_URL,
        method: 'POST',
        body: {
          model: normalizedModel,
          messages: buildTranslationMessages(request.text),
          stream: false,
        },
        signal,
      });
    } catch (cause) {
      throw requestError(cause);
    }

    return {
      text: readContent(response),
      providerId: 'ollama',
      ...(request.sourceLanguage === undefined
        ? {}
        : { sourceLanguage: request.sourceLanguage }),
    };
  };

  return {
    id: 'ollama',
    availability: async () => ({
      status: isConfigured() ? 'available' : 'unavailable',
    }),
    testConnection: async () => {
      if (!isConfigured()) return { ok: false, error: configurationError() };
      try {
        await translate({ text: '测试', targetLanguage: 'en' });
        return { ok: true, detail: 'Connection successful.' };
      } catch (cause) {
        return {
          ok: false,
          error: cause instanceof TranslationError ? cause : requestError(cause),
        };
      }
    },
    translate: (request, options) => translate(request, options?.signal),
  };
}

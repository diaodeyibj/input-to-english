import {
  translationErrorCodes,
  type ConnectionTestResult,
  type ProviderId,
  type TranslationErrorCode,
  type TranslationResult,
} from '../../../../packages/core/src/index';

export type TranslateRuntimeMessage = {
  type: 'translate';
  providerId: ProviderId;
  text: string;
  sourceLanguage?: string;
};

export type TestProviderRuntimeMessage = {
  type: 'test-provider';
  providerId: ProviderId;
};

export type ListOllamaModelsRuntimeMessage = { type: 'list-ollama-models' };
export type GetActiveProviderRuntimeMessage = { type: 'get-active-provider' };

export type RuntimeMessage =
  | TranslateRuntimeMessage
  | TestProviderRuntimeMessage
  | ListOllamaModelsRuntimeMessage
  | GetActiveProviderRuntimeMessage;

export type SerializedRuntimeError = {
  code: TranslationErrorCode;
  userMessage: string;
  retryable: boolean;
};

export type RuntimeSuccessResponse =
  | { ok: true; type: 'translate'; result: TranslationResult }
  | { ok: true; type: 'test-provider'; result: ConnectionTestResult }
  | { ok: true; type: 'list-ollama-models'; models: string[] }
  | { ok: true; type: 'get-active-provider'; activeProvider: ProviderId };

export type RuntimeErrorResponse = { ok: false; error: SerializedRuntimeError };
export type RuntimeResponse = RuntimeSuccessResponse | RuntimeErrorResponse;

const providerIds: readonly ProviderId[] = ['browser', 'deepseek', 'kimi', 'ollama'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && providerIds.includes(value as ProviderId);
}

function isErrorCode(value: unknown): value is TranslationErrorCode {
  return typeof value === 'string' && translationErrorCodes.includes(value as TranslationErrorCode);
}

export function parseRuntimeMessage(value: unknown): RuntimeMessage | null {
  if (!isRecord(value)) return null;

  if (value.type === 'translate') {
    if (!isProviderId(value.providerId) || typeof value.text !== 'string') return null;
    if (value.sourceLanguage !== undefined && typeof value.sourceLanguage !== 'string') return null;
    return value.sourceLanguage === undefined
      ? { type: 'translate', providerId: value.providerId, text: value.text }
      : {
          type: 'translate',
          providerId: value.providerId,
          text: value.text,
          sourceLanguage: value.sourceLanguage,
        };
  }

  if (value.type === 'test-provider') {
    return isProviderId(value.providerId)
      ? { type: 'test-provider', providerId: value.providerId }
      : null;
  }

  if (value.type === 'list-ollama-models') return { type: 'list-ollama-models' };
  return value.type === 'get-active-provider' ? { type: 'get-active-provider' } : null;
}

export function serializeRuntimeError(error: unknown): RuntimeErrorResponse {
  const candidate = isRecord(error) ? error : {};
  return {
    ok: false,
    error: {
      code: isErrorCode(candidate.code) ? candidate.code : 'UNKNOWN',
      userMessage:
        typeof candidate.userMessage === 'string'
          ? candidate.userMessage
          : 'An unexpected error occurred.',
      retryable: candidate.retryable === true,
    },
  };
}

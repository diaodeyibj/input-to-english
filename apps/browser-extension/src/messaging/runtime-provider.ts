import {
  TranslationError,
  translationErrorCodes,
  type ProviderId,
  type TranslationErrorCode,
  type TranslationProvider,
  type TranslationRequest,
  type TranslationResult,
} from '../../../../packages/core/src/index';
import type { RuntimeMessage } from './protocol';

export type RemoteProviderId = Exclude<ProviderId, 'browser'>;

export interface RuntimeClient {
  sendMessage(message: RuntimeMessage): Promise<unknown>;
}

const providerIds: readonly ProviderId[] = ['browser', 'deepseek', 'kimi', 'ollama'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function error(code: TranslationErrorCode, userMessage: string, retryable: boolean): TranslationError {
  return new TranslationError({ code, userMessage, retryable });
}

function malformedResponse(): TranslationError {
  return error('MALFORMED_RESPONSE', 'The provider returned an invalid response.', false);
}

function readRuntimeError(value: unknown): TranslationError {
  if (!isRecord(value) || typeof value.code !== 'string' ||
      !translationErrorCodes.includes(value.code as TranslationErrorCode) ||
      typeof value.userMessage !== 'string' || typeof value.retryable !== 'boolean') {
    return malformedResponse();
  }
  return error(value.code as TranslationErrorCode, value.userMessage, value.retryable);
}

async function send(client: RuntimeClient, message: RuntimeMessage): Promise<Record<string, unknown>> {
  let response: unknown;
  try {
    response = await client.sendMessage(message);
  } catch {
    throw error('NETWORK_ERROR', 'The extension background service could not be reached.', true);
  }
  if (!isRecord(response)) throw malformedResponse();
  if (response.ok === false) throw readRuntimeError(response.error);
  if (response.ok !== true) throw malformedResponse();
  return response;
}

export async function getActiveProvider(runtimeClient: RuntimeClient): Promise<ProviderId> {
  const response = await send(runtimeClient, { type: 'get-active-provider' });
  if (response.type !== 'get-active-provider' || typeof response.activeProvider !== 'string' ||
      !providerIds.includes(response.activeProvider as ProviderId)) {
    throw malformedResponse();
  }
  return response.activeProvider as ProviderId;
}

function readTranslationResult(value: unknown, id: RemoteProviderId): TranslationResult {
  if (!isRecord(value) || typeof value.text !== 'string' || value.providerId !== id ||
      (value.sourceLanguage !== undefined && typeof value.sourceLanguage !== 'string')) {
    throw malformedResponse();
  }
  return {
    text: value.text,
    providerId: id,
    ...(value.sourceLanguage === undefined ? {} : { sourceLanguage: value.sourceLanguage }),
  };
}

export function createRuntimeProvider(id: RemoteProviderId, runtimeClient: RuntimeClient): TranslationProvider {
  return {
    id,
    availability: async () => ({ status: 'available' }),
    testConnection: async () => {
      try {
        const response = await send(runtimeClient, { type: 'test-provider', providerId: id });
        if (response.type !== 'test-provider' || !isRecord(response.result) ||
            response.result.ok !== true || typeof response.result.detail !== 'string') {
          throw malformedResponse();
        }
        return { ok: true, detail: response.result.detail };
      } catch (cause) {
        return {
          ok: false,
          error: cause instanceof TranslationError ? cause : malformedResponse(),
        };
      }
    },
    translate: async (request: TranslationRequest) => {
      const response = await send(runtimeClient, {
        type: 'translate',
        providerId: id,
        text: request.text,
        ...(request.sourceLanguage === undefined ? {} : { sourceLanguage: request.sourceLanguage }),
      });
      if (response.type !== 'translate') throw malformedResponse();
      return readTranslationResult(response.result, id);
    },
  };
}

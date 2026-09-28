import {
  TranslationError,
  TranslationRouter,
  withTimeout,
  type TranslationProvider,
} from '../../../../packages/core/src/index';
import {
  createDeepSeekProvider,
  createJsonHttpClient,
  createKimiProvider,
  createOllamaProvider,
  listOllamaModels,
  type JsonHttpClient,
} from '../../../../packages/providers/src/index';
import { SettingsStore, type ExtensionSettings } from '../storage/settings';
import { parseRuntimeMessage, serializeRuntimeError, type RuntimeResponse } from './protocol';

export interface BackgroundDependencies {
  settings: Pick<SettingsStore, 'get'>;
  http: JsonHttpClient;
}

const REQUEST_TIMEOUT_MS = 30_000;

function remoteProviders(settings: ExtensionSettings, http: JsonHttpClient): TranslationProvider[] {
  return [
    createDeepSeekProvider({ ...settings.deepseek, http }),
    createKimiProvider({ ...settings.kimi, http }),
    createOllamaProvider({ ...settings.ollama, http }),
  ];
}

function safeFailure(cause: unknown): RuntimeResponse {
  if (cause instanceof TranslationError) return serializeRuntimeError(cause);
  return serializeRuntimeError(new TranslationError({
    code: 'UNKNOWN',
    userMessage: 'An unexpected error occurred.',
    retryable: false,
  }));
}

export async function handleRuntimeMessage(
  message: unknown,
  dependencies: BackgroundDependencies = {
    settings: new SettingsStore(),
    http: createJsonHttpClient(),
  },
): Promise<RuntimeResponse> {
  const request = parseRuntimeMessage(message);
  if (request === null || (request.type !== 'list-ollama-models' && request.providerId === 'browser')) {
    return safeFailure(null);
  }

  try {
    if (request.type === 'list-ollama-models') {
      const models = await withTimeout(
        (signal) => listOllamaModels(dependencies.http, signal),
        REQUEST_TIMEOUT_MS,
      );
      return { ok: true, type: 'list-ollama-models', models };
    }

    return await withTimeout(async (signal): Promise<RuntimeResponse> => {
      const settings = await dependencies.settings.get();
      signal.throwIfAborted();
      const router = new TranslationRouter(remoteProviders(settings, dependencies.http));

      if (request.type === 'translate') {
        const result = await router.translate(request.providerId, {
          text: request.text,
          targetLanguage: 'en',
          ...(request.sourceLanguage === undefined ? {} : { sourceLanguage: request.sourceLanguage }),
        }, { signal });
        return { ok: true, type: 'translate', result };
      }

      await router.translate(request.providerId, { text: '测试', targetLanguage: 'en' }, { signal });
      return {
        ok: true,
        type: 'test-provider',
        result: { ok: true, detail: 'Connection successful.' },
      };
    }, REQUEST_TIMEOUT_MS);
  } catch (cause) {
    return safeFailure(cause);
  }
}

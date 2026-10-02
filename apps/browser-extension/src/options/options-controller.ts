import {
  TranslationError,
  translationErrorCodes,
  type ConnectionTestResult,
  type ProviderAvailability,
  type ProviderId,
  type TranslationErrorCode,
} from '../../../../packages/core/src/index';
import type { LanguagePairAvailability } from '../../../../packages/providers/src/index';
import type { RuntimeMessage } from '../messaging/protocol';
import type { RuntimeClient } from '../messaging/runtime-provider';
import {
  SettingsStore,
  type DisplayLanguage,
  type ExtensionSettings,
  type ExtensionSettingsPatch,
} from '../storage/settings';

export interface OptionsSettingsStore {
  get(): Promise<ExtensionSettings>;
  update(patch: ExtensionSettingsPatch): Promise<ExtensionSettings>;
  clearApiKey(provider: 'deepseek' | 'kimi'): Promise<ExtensionSettings>;
}

export interface BrowserCapabilityBridge {
  availability(): Promise<ProviderAvailability>;
}

export interface OptionsSnapshot {
  displayLanguage?: DisplayLanguage;
  activeProvider: ProviderId;
  browser: ProviderAvailability;
  deepseek: { hasApiKey: boolean; model: string };
  kimi: { hasApiKey: boolean; model: string };
}

export interface CloudConfigInput {
  apiKey: string;
  model: string;
}

export interface OptionsControllerDependencies {
  settings: OptionsSettingsStore;
  runtimeClient: RuntimeClient;
  browserCapability: BrowserCapabilityBridge;
}

interface BrowserLanguageScope {
  LanguageDetector?: { availability(): Promise<LanguagePairAvailability> };
  Translator?: unknown;
}

const providerIds: readonly ProviderId[] = ['browser', 'deepseek', 'kimi'];

function error(
  code: TranslationErrorCode,
  userMessage: string,
  retryable: boolean,
): TranslationError {
  return new TranslationError({ code, userMessage, retryable });
}

function malformedResponse(): TranslationError {
  return error('MALFORMED_RESPONSE', 'The extension returned an invalid response.', false);
}

function networkError(): TranslationError {
  return error('NETWORK_ERROR', 'The extension background service could not be reached.', true);
}

function unknownError(): TranslationError {
  return error('UNKNOWN', 'The settings action could not be completed.', false);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRuntimeError(value: unknown): TranslationError {
  if (!isRecord(value) || typeof value.code !== 'string' ||
      !translationErrorCodes.includes(value.code as TranslationErrorCode) ||
      typeof value.userMessage !== 'string' || typeof value.retryable !== 'boolean') {
    return malformedResponse();
  }
  return error(value.code as TranslationErrorCode, value.userMessage, value.retryable);
}

function safeFailure(cause: unknown): TranslationError {
  return cause instanceof TranslationError
    ? error(cause.code, cause.userMessage, cause.retryable)
    : unknownError();
}

function toSnapshot(
  settings: ExtensionSettings,
  browserAvailability: ProviderAvailability,
): OptionsSnapshot {
  return {
    displayLanguage: settings.displayLanguage ?? 'zh-CN',
    activeProvider: settings.activeProvider,
    browser: browserAvailability,
    deepseek: {
      hasApiKey: settings.deepseek.apiKey.trim().length > 0,
      model: settings.deepseek.model,
    },
    kimi: {
      hasApiKey: settings.kimi.apiKey.trim().length > 0,
      model: settings.kimi.model,
    },
  };
}

function providerLabel(provider: 'deepseek' | 'kimi'): string {
  return provider === 'deepseek' ? 'DeepSeek' : 'Kimi';
}

export function createBrowserCapabilityBridge(
  scope: BrowserLanguageScope = globalThis as unknown as BrowserLanguageScope,
): BrowserCapabilityBridge {
  return {
    async availability() {
      if (!scope.LanguageDetector || !scope.Translator) {
        return {
          status: 'unavailable',
          detail: 'Browser translation is unavailable in this browser.',
        };
      }

      try {
        const status = await scope.LanguageDetector.availability();
        if (!['available', 'downloadable', 'downloading', 'unavailable'].includes(status)) {
          return {
            status: 'unavailable',
            detail: 'Browser translation capability could not be determined.',
          };
        }
        const detail = status === 'available'
          ? 'Browser language detection is ready. Translation packs are checked per language.'
          : status === 'downloadable'
            ? 'Browser language tools will download when first used.'
            : status === 'downloading'
              ? 'Browser language tools are downloading.'
              : 'Browser translation is unavailable in this browser.';
        return { status, detail };
      } catch {
        return {
          status: 'unavailable',
          detail: 'Browser translation capability could not be determined.',
        };
      }
    },
  };
}

function defaultDependencies(): OptionsControllerDependencies {
  return {
    settings: new SettingsStore(),
    runtimeClient: {
      sendMessage: (message: RuntimeMessage) => browser.runtime.sendMessage(message),
    },
    browserCapability: createBrowserCapabilityBridge(),
  };
}

export class OptionsController {
  private readonly dependencies: OptionsControllerDependencies;
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(dependencies: OptionsControllerDependencies = defaultDependencies()) {
    this.dependencies = dependencies;
  }

  private enqueueMutation<T>(action: () => Promise<T>): Promise<T> {
    const result = this.mutationTail.then(action);
    this.mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  async load(): Promise<OptionsSnapshot> {
    try {
      const [settings, browserAvailability] = await Promise.all([
        this.dependencies.settings.get(),
        this.dependencies.browserCapability.availability(),
      ]);
      return toSnapshot(settings, browserAvailability);
    } catch (cause) {
      throw safeFailure(cause);
    }
  }

  async saveProvider(id: ProviderId): Promise<OptionsSnapshot> {
    if (!providerIds.includes(id)) throw unknownError();
    return this.enqueueMutation(async () => {
      try {
        await this.dependencies.settings.update({ activeProvider: id });
        return await this.load();
      } catch (cause) {
        throw safeFailure(cause);
      }
    });
  }

  async saveDisplayLanguage(language: DisplayLanguage): Promise<OptionsSnapshot> {
    return this.enqueueMutation(async () => {
      try {
        await this.dependencies.settings.update({ displayLanguage: language });
        return await this.load();
      } catch (cause) {
        throw safeFailure(cause);
      }
    });
  }

  async saveCloudConfig(
    id: 'deepseek' | 'kimi',
    config: CloudConfigInput,
  ): Promise<OptionsSnapshot> {
    const apiKey = config.apiKey.trim();
    const model = config.model.trim();
    if (model.length === 0) {
      throw error('PROVIDER_NOT_CONFIGURED', `Enter a ${providerLabel(id)} model before saving.`, false);
    }

    return this.enqueueMutation(async () => {
      try {
        const current = await this.dependencies.settings.get();
        if (apiKey.length === 0 && current[id].apiKey.trim().length === 0) {
          throw error(
            'PROVIDER_NOT_CONFIGURED',
            `Enter a ${providerLabel(id)} API key before saving.`,
            false,
          );
        }
        await this.dependencies.settings.update({
          [id]: {
            model,
            ...(apiKey.length === 0 ? {} : { apiKey }),
          },
        });
        return await this.load();
      } catch (cause) {
        throw safeFailure(cause);
      }
    });
  }

  async deleteApiKey(id: 'deepseek' | 'kimi'): Promise<OptionsSnapshot> {
    return this.enqueueMutation(async () => {
      try {
        await this.dependencies.settings.clearApiKey(id);
        return await this.load();
      } catch (cause) {
        throw safeFailure(cause);
      }
    });
  }

  async testProvider(id: ProviderId): Promise<ConnectionTestResult> {
    if (id === 'browser') {
      try {
        const availability = await this.dependencies.browserCapability.availability();
        if (availability.status !== 'unavailable') {
          return {
            ok: true,
            detail: availability.detail ?? 'Browser language tools are available.',
          };
        }
        return {
          ok: false,
          error: error(
            'BROWSER_API_UNAVAILABLE',
            availability.detail ?? 'Browser translation is unavailable in this browser.',
            false,
          ),
        };
      } catch {
        return { ok: false, error: unknownError() };
      }
    }

    let response: unknown;
    try {
      response = await this.dependencies.runtimeClient.sendMessage({
        type: 'test-provider',
        providerId: id,
      });
    } catch {
      return { ok: false, error: networkError() };
    }
    if (!isRecord(response)) return { ok: false, error: malformedResponse() };
    if (response.ok === false) return { ok: false, error: readRuntimeError(response.error) };
    if (response.ok !== true || response.type !== 'test-provider' || !isRecord(response.result)) {
      return { ok: false, error: malformedResponse() };
    }
    if (response.result.ok === true && typeof response.result.detail === 'string') {
      return { ok: true, detail: response.result.detail };
    }
    if (response.result.ok === false) {
      return { ok: false, error: readRuntimeError(response.result.error) };
    }
    return { ok: false, error: malformedResponse() };
  }

}

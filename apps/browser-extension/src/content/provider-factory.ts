import type { TranslationProvider } from '../../../../packages/core/src/contracts';
import {
  createBrowserLocalProvider,
  type LanguageDetectionBridge,
  type LanguagePairAvailability,
  type TranslationBridge,
} from '../../../../packages/providers/src/browser-local';
import { createRuntimeProvider, type RuntimeClient } from '../messaging/runtime-provider';
import type { ExtensionSettings } from '../storage/settings';

interface DetectorModel {
  detect(text: string, options?: { signal?: AbortSignal }): Promise<
    Array<{ detectedLanguage?: string; confidence?: number }>
  >;
  destroy(): void;
}

interface TranslatorModel {
  translate(text: string, options?: { signal?: AbortSignal }): Promise<string>;
  destroy(): void;
}

export interface BrowserAiScope {
  LanguageDetector?: {
    availability(): Promise<LanguagePairAvailability>;
    create(options?: { signal?: AbortSignal }): Promise<DetectorModel>;
  };
  Translator?: {
    availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<LanguagePairAvailability>;
    create(options: {
      sourceLanguage: string;
      targetLanguage: string;
      signal?: AbortSignal;
      monitor?: (monitor: EventTarget) => void;
    }): Promise<TranslatorModel>;
  };
}

export interface DocumentBrowserBridges {
  detector?: LanguageDetectionBridge;
  translator?: TranslationBridge;
}

export interface ProviderFactoryDependencies extends DocumentBrowserBridges {
  runtimeClient: RuntimeClient;
}

export function createDocumentBrowserBridges(
  scope: BrowserAiScope = globalThis as unknown as BrowserAiScope,
): DocumentBrowserBridges {
  const detectorApi = scope.LanguageDetector;
  const translatorApi = scope.Translator;
  const detector: LanguageDetectionBridge | undefined = detectorApi && {
    async detect(text, options) {
      if (await detectorApi.availability() === 'unavailable') {
        throw new Error('Language Detector is unavailable.');
      }
      const model = await detectorApi.create({ signal: options?.signal });
      try {
        const result = await model.detect(text, { signal: options?.signal });
        const first = result[0];
        if (!first || typeof first.detectedLanguage !== 'string' ||
            typeof first.confidence !== 'number') {
          throw new Error('Language Detector returned no usable result.');
        }
        return { detectedLanguage: first.detectedLanguage, confidence: first.confidence };
      } finally {
        model.destroy();
      }
    },
  };
  const translator: TranslationBridge | undefined = translatorApi && {
    availability(source, target) {
      return translatorApi.availability({ sourceLanguage: source, targetLanguage: target });
    },
    async translate(text, source, target, options) {
      const model = await translatorApi.create({
        sourceLanguage: source,
        targetLanguage: target,
        signal: options?.signal,
        monitor: (monitor) => {
          monitor.addEventListener('downloadprogress', (event) => {
            const progress = event as ProgressEvent;
            options?.onProgress?.({
              kind: 'model-download', loaded: progress.loaded, total: progress.total,
            });
          });
        },
      });
      try {
        return await model.translate(text, { signal: options?.signal });
      } finally {
        model.destroy();
      }
    },
  };
  return { detector, translator };
}

export function createConfiguredProvider(
  settings: Pick<ExtensionSettings, 'activeProvider'>,
  dependencies: ProviderFactoryDependencies,
): TranslationProvider {
  if (settings.activeProvider === 'browser') {
    const bridges = createDocumentBrowserBridges();
    return createBrowserLocalProvider({
      detector: dependencies.detector ?? bridges.detector,
      translator: dependencies.translator ?? bridges.translator,
    });
  }
  return createRuntimeProvider(settings.activeProvider, dependencies.runtimeClient);
}

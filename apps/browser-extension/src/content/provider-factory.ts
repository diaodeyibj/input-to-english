import { TranslationError, type ProviderId, type TranslationOptions, type TranslationProvider,
  type TranslationRequest, type TranslationResult } from '../../../../packages/core/src/index';
import {
  createBrowserLocalProvider,
  type LanguageDetectionBridge,
  type LanguagePairAvailability,
  type TranslationBridge,
} from '../../../../packages/providers/src/browser-local';
import { createRuntimeProvider, getActiveProvider, type RuntimeClient } from '../messaging/runtime-provider';
import type { ExtensionSettings } from '../storage/settings';
import type { PreparedTranslationAction, UserActivatedTranslationProvider } from './translation-controller';

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
  translator?: PreparedTranslationBridge;
}

interface PreparedModel {
  translate(text: string, options?: TranslationOptions): Promise<string>;
  dispose(): void;
}

interface PreparedTranslationBridge extends TranslationBridge {
  prepare?(source: string, target: string, options?: TranslationOptions): PreparedModel;
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
      // Model creation must begin during the user's input/click task when a
      // first-use download needs activation. Awaiting availability first loses it.
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
  const translator: PreparedTranslationBridge | undefined = translatorApi && {
    availability(source, target) {
      return translatorApi.availability({ sourceLanguage: source, targetLanguage: target });
    },
    async translate(text, source, target, options) {
      const prepared = this.prepare!(source, target, options);
      try {
        return await prepared.translate(text, options);
      } finally {
        prepared.dispose();
      }
    },
    prepare(source, target, options) {
      // This call, not the promise resolution, is activation sensitive.
      const created = translatorApi.create({
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
      let disposed = false;
      let instance: TranslatorModel | undefined;
      void created.then((model) => {
        instance = model;
        if (disposed) model.destroy();
      }, () => undefined);
      return {
        async translate(text, translateOptions) {
          const model = await created;
          if (disposed) throw new DOMException('Translation cancelled.', 'AbortError');
          return model.translate(text, { signal: translateOptions?.signal });
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          instance?.destroy();
        },
      };
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

interface DetectionEntry {
  text: string;
  status: 'pending' | 'ready' | 'failed';
  sourceLanguage?: string;
  pairAvailability?: LanguagePairAvailability;
}

export interface ActiveProvider extends UserActivatedTranslationProvider {
  refreshSelection(): Promise<ProviderId>;
}

function canonicalSource(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '' || value === 'und') return undefined;
  try { return Intl.getCanonicalLocales(value)[0]; } catch { return undefined; }
}

function preparingError(): TranslationError {
  return new TranslationError({
    code: 'BROWSER_API_UNAVAILABLE',
    userMessage: 'Preparing browser language detection. Try translating again shortly.',
    retryable: true,
  });
}

function browserUnavailableError(): TranslationError {
  return new TranslationError({
    code: 'BROWSER_API_UNAVAILABLE',
    userMessage: 'Browser language detection is unavailable. Check browser support.',
    retryable: false,
  });
}

/** Resolve the trusted background selection on every action, with a cached hint for user activation. */
export function createActiveProvider(dependencies: ProviderFactoryDependencies): ActiveProvider {
  let lastId: ProviderId = 'browser';
  let trustedSelection = false;
  let selectionRevision = 0;
  const bridges = createDocumentBrowserBridges();
  const detector = dependencies.detector ?? bridges.detector;
  const translator = dependencies.translator ?? bridges.translator;
  let detection: DetectionEntry | undefined;
  let detecting = false;

  const refreshSelection = async (): Promise<ProviderId> => {
    const revision = ++selectionRevision;
    const id = await getActiveProvider(dependencies.runtimeClient);
    if (revision === selectionRevision) {
      lastId = id;
      trustedSelection = true;
    }
    return id;
  };

  const startDetection = (entry: DetectionEntry): void => {
    if (!detector || !translator) {
      entry.status = 'failed';
      return;
    }
    detecting = true;
    // The first call starts model creation in the user input/click task. Edits
    // made while it is pending are coalesced to one later detection pass.
    void detector.detect(entry.text).then(async (result) => {
      if (detection !== entry) return;
      const source = result.confidence >= 0.5 && result.confidence <= 1
        ? canonicalSource(result.detectedLanguage) : undefined;
      if (!source) throw new Error('Language detection returned no supported source.');
      const pairAvailability = source.split('-')[0]?.toLowerCase() === 'en'
        ? 'available' : await translator.availability(source, 'en');
      if (!pairAvailability) throw new Error('Translator availability is missing.');
      if (detection === entry) {
        entry.sourceLanguage = source;
        entry.pairAvailability = pairAvailability;
        entry.status = 'ready';
      }
    }).catch(() => { if (detection === entry) entry.status = 'failed'; })
      .finally(() => {
        detecting = false;
        if (detection && detection !== entry && detection.status === 'pending') {
          startDetection(detection);
        }
      });
  };

  const prepareInput = (text: string, force = false): void => {
    if ((!force && (!trustedSelection || lastId !== 'browser')) ||
        (detection?.text === text && detection.status !== 'failed') ||
        text.trim().length === 0) return;
    const entry: DetectionEntry = { text, status: 'pending' };
    detection = entry;
    if (!detecting) startDetection(entry);
  };

  const selected = async (): Promise<TranslationProvider> => {
    const id = await refreshSelection();
    return createConfiguredProvider({ activeProvider: id }, dependencies);
  };
  return {
    get id() { return lastId; },
    refreshSelection,
    prepareInput,
    beginUserAction(request, options): PreparedTranslationAction {
      const selectionWasBrowser = trustedSelection && lastId === 'browser';
      if (selectionWasBrowser) prepareInput(request.text);
      const entry = detection?.text === request.text && detection.status === 'ready'
        ? detection : undefined;
      const sourceLanguage = entry?.sourceLanguage;
      let prepared: PreparedModel | undefined;
      let creationFailed = false;
      if (selectionWasBrowser && sourceLanguage &&
          sourceLanguage.split('-')[0]?.toLowerCase() !== 'en' &&
          entry?.pairAvailability !== 'unavailable') {
        try {
          prepared = translator?.prepare?.(sourceLanguage, 'en', options);
        } catch {
          creationFailed = true;
        }
      }
      const disposePrepared = () => prepared?.dispose();
      options?.signal?.addEventListener('abort', disposePrepared, { once: true });
      if (options?.signal?.aborted) disposePrepared();
      const selectedProvider = refreshSelection();
      // A selection changed in Options may not have been known during input.
      // Prepare the next click once the background confirms Browser Local.
      void selectedProvider.then((id) => {
        if (id === 'browser' && !selectionWasBrowser && !entry) {
          prepareInput(request.text, true);
        }
      }, () => undefined);
      let used = false;
      return {
        selectedProvider,
        sourceLanguage,
        async translate(nextRequest: TranslationRequest, nextOptions?: TranslationOptions): Promise<TranslationResult> {
          if (used) throw preparingError();
          used = true;
          const id = await selectedProvider;
          nextOptions?.signal?.throwIfAborted();
          if (id !== 'browser') {
            prepared?.dispose();
            return createRuntimeProvider(id, dependencies.runtimeClient).translate(nextRequest, nextOptions);
          }
          if (!entry || !sourceLanguage || !prepared) {
            if (creationFailed) {
              throw new TranslationError({ code: 'MODEL_DOWNLOAD_FAILED',
                userMessage: 'The browser language pack could not start. Try again.', retryable: true });
            }
            if (detection?.text === request.text && detection.status === 'failed') {
              throw browserUnavailableError();
            }
            if (entry?.pairAvailability === 'unavailable') {
              throw new TranslationError({ code: 'UNSUPPORTED_LANGUAGE',
                userMessage: 'Browser translation does not support this language pair.', retryable: false });
            }
            throw preparingError();
          }
          const local = createBrowserLocalProvider({
            detector,
            translator: {
              availability: (source, target) => translator!.availability(source, target),
              translate: (text, _source, _target, translationOptions) =>
                prepared.translate(text, translationOptions),
            },
          });
          try {
            return await local.translate({ ...nextRequest, sourceLanguage }, nextOptions);
          } finally {
            prepared.dispose();
          }
        },
        dispose() {
          options?.signal?.removeEventListener('abort', disposePrepared);
          disposePrepared();
        },
      };
    },
    async availability() { return (await selected()).availability(); },
    async translate(request, options) {
      const provider = await selected();
      options?.signal?.throwIfAborted();
      return provider.translate(request, options);
    },
  };
}

import {
  TranslationError,
  type TranslationOptions,
  type TranslationProvider,
} from '../../core/src/index';

export interface LanguageDetectionBridge {
  detect(
    text: string,
    options?: { signal?: AbortSignal },
  ): Promise<{ detectedLanguage: string; confidence: number }>;
}

export type LanguagePairAvailability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

export interface TranslationBridge {
  availability(source: string, target: string): Promise<LanguagePairAvailability>;
  translate(
    text: string,
    source: string,
    target: string,
    options?: TranslationOptions,
  ): Promise<string>;
}

export interface BrowserLocalProviderOptions {
  detector?: LanguageDetectionBridge;
  translator?: TranslationBridge;
}

function error(
  code: ConstructorParameters<typeof TranslationError>[0]['code'],
  userMessage: string,
  retryable: boolean,
): TranslationError {
  return new TranslationError({ code, userMessage, retryable });
}

function browserUnavailable(): TranslationError {
  return error(
    'BROWSER_API_UNAVAILABLE',
    'Browser translation is unavailable. Check your browser and language support.',
    false,
  );
}

function timedOut(): TranslationError {
  return error('TIMEOUT', 'Browser translation was interrupted. Please try again.', true);
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw timedOut();
}

function isAbort(cause: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true ||
    (cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError'))
  );
}

function normalizeLanguageTag(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value === 'und') return undefined;
  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    return undefined;
  }
}

export function createBrowserLocalProvider({
  detector,
  translator,
}: BrowserLocalProviderOptions): TranslationProvider {
  return {
    id: 'browser',
    availability: async () => ({
      status: detector && translator ? 'available' : 'unavailable',
    }),
    async translate(request, options) {
      checkAbort(options?.signal);
      if (!detector || !translator) throw browserUnavailable();

      let source = normalizeLanguageTag(request.sourceLanguage);
      if (request.sourceLanguage === undefined) {
        let detection: { detectedLanguage: string; confidence: number };
        try {
          detection = await detector.detect(request.text, { signal: options?.signal });
        } catch (cause) {
          throw isAbort(cause, options?.signal) ? timedOut() : browserUnavailable();
        }
        checkAbort(options?.signal);
        if (
          !detection ||
          !Number.isFinite(detection.confidence) ||
          detection.confidence < 0.5 ||
          detection.confidence > 1
        ) {
          throw browserUnavailable();
        }
        source = normalizeLanguageTag(detection.detectedLanguage);
      }
      if (!source) throw browserUnavailable();
      if (source.toLowerCase().split('-')[0] === 'en') {
        throw error('ALREADY_ENGLISH', 'This input is already in English.', false);
      }

      let pairAvailability: LanguagePairAvailability;
      try {
        pairAvailability = await translator.availability(source, 'en');
      } catch (cause) {
        throw isAbort(cause, options?.signal) ? timedOut() : browserUnavailable();
      }
      checkAbort(options?.signal);
      if (pairAvailability === 'unavailable') {
        throw error(
          'UNSUPPORTED_LANGUAGE',
          'Browser translation does not support this language pair.',
          false,
        );
      }
      if (
        pairAvailability !== 'available' &&
        pairAvailability !== 'downloadable' &&
        pairAvailability !== 'downloading'
      ) {
        throw browserUnavailable();
      }

      let text: string;
      try {
        text = await translator.translate(request.text, source, 'en', options);
      } catch (cause) {
        if (isAbort(cause, options?.signal)) throw timedOut();
        if (pairAvailability === 'downloadable' || pairAvailability === 'downloading') {
          throw error('MODEL_DOWNLOAD_FAILED', 'The browser language pack could not download.', true);
        }
        throw error('UNKNOWN', 'Browser translation failed. Please try again.', true);
      }
      checkAbort(options?.signal);
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw error('MALFORMED_RESPONSE', 'Browser translation returned no text.', false);
      }
      return { text, providerId: 'browser', sourceLanguage: source };
    },
  };
}

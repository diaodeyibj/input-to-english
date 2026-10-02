import { describe, expect, it } from 'vitest';

import { TranslationError, type TranslationRequest, type TranslationProgress } from '../../core/src/index';
import {
  createBrowserLocalProvider,
  type LanguageDetectionBridge,
  type TranslationBridge,
} from '../src/browser-local';

const request: TranslationRequest = { text: '你好，世界', targetLanguage: 'en' };

function bridges() {
  const events: string[] = [];
  const detector: LanguageDetectionBridge = {
    async detect(text, options) {
      events.push(`detect:${text}:${options?.signal ? 'signal' : 'none'}`);
      return { detectedLanguage: 'zh-Hans', confidence: 0.98 };
    },
  };
  const translator: TranslationBridge = {
    async availability(source, target) {
      events.push(`availability:${source}:${target}`);
      return 'available';
    },
    async translate(text, source, target, options) {
      events.push(`translate:${text}:${source}:${target}:${options?.signal ? 'signal' : 'none'}`);
      return 'Hello, world';
    },
  };
  return { detector, translator, events };
}

async function caught(promise: Promise<unknown>): Promise<TranslationError> {
  const error: unknown = await promise.catch((cause: unknown) => cause);
  expect(error).toBeInstanceOf(TranslationError);
  return error as TranslationError;
}

describe('createBrowserLocalProvider', () => {
  it('does not label mixed input as English when its non-English fragment is uncertain', async () => {
    const ready = bridges();
    ready.detector.detect = async () => ({ detectedLanguage: 'en', confidence: 0.99 });
    const failure = await caught(createBrowserLocalProvider(ready).translate({
      text: 'Please help 谢', targetLanguage: 'en',
    }));
    expect(failure.code).toBe('BROWSER_API_UNAVAILABLE');
    expect(ready.events).toEqual([]);
  });

  it('rechecks a supplied English tag when the text includes non-Latin letters', async () => {
    const ready = bridges();
    await expect(createBrowserLocalProvider(ready).translate({
      text: 'Please help谢谢', targetLanguage: 'en', sourceLanguage: 'en-US',
    })).resolves.toMatchObject({ sourceLanguage: 'zh-Hans', text: 'Hello, world' });
  });

  it.each([
    ['谢谢', 'zh'], ['ありがとう', 'ja'], ['감사합니다', 'ko'], ['شكرا', 'ar'], ['Спасибо', 'ru'],
  ])('translates English-dominant input containing %s with the non-English source', async (fragment, language) => {
    const text = `Please help me design a more creative new logo ${fragment}`;
    const ready = bridges();
    ready.detector.detect = async (input) => ({
      detectedLanguage: input === text ? 'en-US' : language, confidence: 0.99,
    });
    const provider = createBrowserLocalProvider(ready);
    await expect(provider.translate({ text, targetLanguage: 'en' })).resolves.toMatchObject({
      text: 'Hello, world', sourceLanguage: language,
    });
    expect(ready.events).toContain(`translate:${text}:${language}:en:none`);
  });

  it.each(['detector', 'translator'] as const)('reports unavailable when the %s API is missing', async (missing) => {
    const ready = bridges();
    const provider = createBrowserLocalProvider({
      detector: missing === 'detector' ? undefined : ready.detector,
      translator: missing === 'translator' ? undefined : ready.translator,
    });

    await expect(provider.availability()).resolves.toEqual({ status: 'unavailable' });
    const error = await caught(provider.translate(request));
    expect(error).toMatchObject({ code: 'BROWSER_API_UNAVAILABLE', retryable: false });
    expect(ready.events).toEqual([]);
  });

  it('detects a BCP 47 source before checking the pair and translating', async () => {
    const ready = bridges();
    const signal = new AbortController().signal;
    const provider = createBrowserLocalProvider(ready);

    await expect(provider.translate(request, { signal })).resolves.toEqual({
      text: 'Hello, world',
      providerId: 'browser',
      sourceLanguage: 'zh-Hans',
    });
    expect(ready.events).toEqual([
      'detect:你好，世界:signal',
      'availability:zh-Hans:en',
      'translate:你好，世界:zh-Hans:en:signal',
    ]);
  });

  it('uses a supplied source tag without invoking the detector', async () => {
    const ready = bridges();
    const provider = createBrowserLocalProvider(ready);

    await expect(provider.translate({ ...request, sourceLanguage: 'fr-CA' })).resolves.toMatchObject({
      sourceLanguage: 'fr-CA',
    });
    expect(ready.events).toEqual([
      'availability:fr-CA:en',
      'translate:你好，世界:fr-CA:en:none',
    ]);
  });

  it('short-circuits detected and supplied English without checking or creating a translator', async () => {
    const ready = bridges();
    ready.detector.detect = async () => ({ detectedLanguage: 'en-US', confidence: 0.95 });
    const provider = createBrowserLocalProvider(ready);

    const english: TranslationRequest = { text: 'Hello, world! 👋', targetLanguage: 'en' };
    expect(await caught(provider.translate(english))).toMatchObject({
      code: 'ALREADY_ENGLISH',
      retryable: false,
    });
    expect(await caught(provider.translate({ ...english, sourceLanguage: 'en-GB' }))).toMatchObject({
      code: 'ALREADY_ENGLISH',
      retryable: false,
    });
    expect(ready.events).toEqual([]);
  });

  it.each([
    { detectedLanguage: 'und', confidence: 0.9 },
    { detectedLanguage: 'not a tag', confidence: 0.9 },
    { detectedLanguage: 'fr', confidence: 0.1 },
    { detectedLanguage: 'en', confidence: Number.NaN },
  ])('rejects an unusable detection result before checking a pair', async (detection) => {
    const ready = bridges();
    ready.detector.detect = async () => detection;
    const error = await caught(createBrowserLocalProvider(ready).translate(request));

    expect(error).toMatchObject({ code: 'BROWSER_API_UNAVAILABLE', retryable: false });
    expect(ready.events).toEqual([]);
  });

  it('reports unsupported local pairs without translating or switching provider', async () => {
    const ready = bridges();
    ready.translator.availability = async (source, target) => {
      ready.events.push(`availability:${source}:${target}`);
      return 'unavailable';
    };

    const error = await caught(createBrowserLocalProvider(ready).translate(request));
    expect(error).toMatchObject({ code: 'UNSUPPORTED_LANGUAGE', retryable: false });
    expect(ready.events).toEqual(['detect:你好，世界:none', 'availability:zh-Hans:en']);
  });

  it('forwards model download progress and returns a translated result', async () => {
    const ready = bridges();
    const progress: TranslationProgress[] = [];
    ready.translator.availability = async () => 'downloadable';
    ready.translator.translate = async (_text, _source, _target, options) => {
      options?.onProgress?.({ kind: 'model-download', loaded: 4, total: 10 });
      options?.onProgress?.({ kind: 'model-download', loaded: 10, total: 10 });
      return 'Hello, world';
    };

    await expect(createBrowserLocalProvider(ready).translate(request, {
      onProgress: (update) => progress.push(update),
    })).resolves.toMatchObject({ text: 'Hello, world', providerId: 'browser' });
    expect(progress).toEqual([
      { kind: 'model-download', loaded: 4, total: 10 },
      { kind: 'model-download', loaded: 10, total: 10 },
    ]);
  });

  it('maps failed model downloads to a safe error without leaking bridge details', async () => {
    const ready = bridges();
    ready.translator.availability = async () => 'downloading';
    ready.translator.translate = async () => {
      throw new Error('secret-browser-file-path');
    };

    const error = await caught(createBrowserLocalProvider(ready).translate(request));
    expect(error).toMatchObject({ code: 'MODEL_DOWNLOAD_FAILED', retryable: true });
    expect(String(error)).not.toContain('secret-browser-file-path');
    expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
  });

  it('maps bridge failures to safe browser errors', async () => {
    const ready = bridges();
    ready.detector.detect = async () => {
      throw new Error('secret-detector-detail');
    };
    const error = await caught(createBrowserLocalProvider(ready).translate(request));
    expect(error).toMatchObject({ code: 'BROWSER_API_UNAVAILABLE', retryable: false });
    expect(String(error)).not.toContain('secret-detector-detail');
  });

  it('stops an already aborted request before calling a bridge', async () => {
    const ready = bridges();
    const controller = new AbortController();
    controller.abort();

    const error = await caught(createBrowserLocalProvider(ready).translate(request, {
      signal: controller.signal,
    }));
    expect(error).toMatchObject({ code: 'TIMEOUT', retryable: true });
    expect(ready.events).toEqual([]);
  });

  it('maps an abort during translation and ignores a late result', async () => {
    const ready = bridges();
    const controller = new AbortController();
    ready.translator.translate = async () => {
      controller.abort();
      return 'late result';
    };

    const error = await caught(createBrowserLocalProvider(ready).translate(request, {
      signal: controller.signal,
    }));
    expect(error).toMatchObject({ code: 'TIMEOUT', retryable: true });
  });
});

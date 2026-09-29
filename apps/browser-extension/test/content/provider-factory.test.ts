// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '../../src/storage/settings';
import { createEditorHandle } from '../../src/sites/dom-editor';
import { TranslationController } from '../../src/content/translation-controller';
import { createTranslateControl } from '../../src/ui/translate-control';
import {
  createActiveProvider,
  createConfiguredProvider,
  createDocumentBrowserBridges,
} from '../../src/content/provider-factory';

function localApis() {
  const detectorCreate = vi.fn(() => Promise.resolve({
    detect: vi.fn(() => Promise.resolve([{ detectedLanguage: 'zh', confidence: 0.99 }])),
    destroy: vi.fn(),
  }));
  const translatorCreate = vi.fn(() => Promise.resolve({
    translate: vi.fn(() => Promise.resolve('Hello')),
    destroy: vi.fn(),
  }));
  const translatorAvailability = vi.fn(async () => 'downloadable');
  vi.stubGlobal('LanguageDetector', { availability: vi.fn(async () => 'available'), create: detectorCreate });
  vi.stubGlobal('Translator', { availability: translatorAvailability, create: translatorCreate });
  return { detectorCreate, translatorCreate, translatorAvailability };
}

function controlFor(provider: ReturnType<typeof createActiveProvider>) {
  const editor = document.createElement('textarea');
  editor.value = '你好';
  document.body.append(editor);
  const controller = new TranslationController({ editor: createEditorHandle(editor), provider });
  const control = createTranslateControl();
  document.body.append(control.element);
  control.bind(controller);
  const button = control.element.shadowRoot!.querySelector<HTMLButtonElement>('button[aria-label="Translate prompt to English"]')!;
  return { editor, controller, control, button };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('content provider factory', () => {
  it('starts detector creation during input and translator creation in the click task before selection resolves', async () => {
    const { detectorCreate, translatorCreate, translatorAvailability } = localApis();
    let actionSelection!: (value: unknown) => void;
    let selectionCalls = 0;
    const sendMessage = vi.fn((message: { type: string }) => {
      if (message.type === 'get-active-provider') {
        selectionCalls += 1;
        return selectionCalls === 1
          ? Promise.resolve({ ok: true, type: 'get-active-provider', activeProvider: 'browser' })
          : new Promise((resolve) => { actionSelection = resolve; });
      }
      throw new Error('Browser translation must not send a remote request.');
    });
    const provider = createActiveProvider({ runtimeClient: { sendMessage } });
    await provider.refreshSelection();
    const { editor, controller, button } = controlFor(provider);

    editor.dispatchEvent(new Event('input', { bubbles: true }));
    expect(detectorCreate).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(translatorAvailability).toHaveBeenCalledOnce());
    await Promise.resolve();
    button.click();

    expect(translatorCreate).toHaveBeenCalledOnce();
    expect(editor.value).toBe('你好');
    actionSelection({ ok: true, type: 'get-active-provider', activeProvider: 'browser' });
    await vi.waitFor(() => expect(editor.value).toBe('Hello'));
    expect(controller.state.status).toBe('success');
    expect(sendMessage.mock.calls.map(([message]) => message.type)).toEqual([
      'get-active-provider', 'get-active-provider',
    ]);
  });

  it('starts cold detection on click, preserves input while preparing, and translates on retry', async () => {
    const { detectorCreate, translatorCreate, translatorAvailability } = localApis();
    const sendMessage = vi.fn(async () => ({ ok: true, type: 'get-active-provider', activeProvider: 'browser' }));
    const provider = createActiveProvider({ runtimeClient: { sendMessage } });
    await provider.refreshSelection();
    const { editor, controller, button } = controlFor(provider);

    button.click();
    expect(detectorCreate).toHaveBeenCalledOnce();
    expect(translatorCreate).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(controller.state.error?.userMessage).toMatch(/prepar/i));
    expect(editor.value).toBe('你好');
    await vi.waitFor(() => expect(translatorAvailability).toHaveBeenCalledOnce());
    await Promise.resolve();

    button.click();
    expect(translatorCreate).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(editor.value).toBe('Hello'));
  });

  it('prepares the local detector after a provider switch and never sends the prompt remotely', async () => {
    const { detectorCreate, translatorCreate, translatorAvailability } = localApis();
    let activeProvider = 'deepseek';
    const sendMessage = vi.fn(async (_message: { type: string }) =>
      ({ ok: true, type: 'get-active-provider', activeProvider }));
    const provider = createActiveProvider({ runtimeClient: { sendMessage } });
    await provider.refreshSelection();
    const { editor, controller, button } = controlFor(provider);
    activeProvider = 'browser';

    button.click();
    await vi.waitFor(() => expect(controller.state.status).toBe('error'));
    expect(editor.value).toBe('你好');
    expect(detectorCreate).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(translatorAvailability).toHaveBeenCalledOnce());
    await Promise.resolve();

    button.click();
    expect(translatorCreate).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(editor.value).toBe('Hello'));
    expect(sendMessage.mock.calls.every(([message]) => message.type === 'get-active-provider')).toBe(true);
  });

  it('reports a failed local detector rather than leaving the user in a perpetual preparing state', async () => {
    vi.stubGlobal('LanguageDetector', {
      availability: vi.fn(async () => 'unavailable'),
      create: vi.fn(async () => { throw new Error('Not supported'); }),
    });
    vi.stubGlobal('Translator', {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(),
    });
    const provider = createActiveProvider({ runtimeClient: {
      sendMessage: vi.fn(async () => ({ ok: true, type: 'get-active-provider', activeProvider: 'browser' })),
    } });
    await provider.refreshSelection();
    const { editor, controller, button } = controlFor(provider);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();

    button.click();
    await vi.waitFor(() => expect(controller.state.status).toBe('error'));
    expect(controller.state.error?.code).toBe('BROWSER_API_UNAVAILABLE');
    expect(controller.state.error?.userMessage).toMatch(/unavailable/i);
    expect(controller.state.error?.userMessage).not.toMatch(/prepar/i);
    expect(editor.value).toBe('你好');
  });

  it('keeps an asynchronous detector failure visible on the next click and retries after new input', async () => {
    let rejectCreation!: (reason: Error) => void;
    const create = vi.fn()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectCreation = reject; }))
      .mockResolvedValue({
        detect: async () => [{ detectedLanguage: 'fr', confidence: 0.99 }],
        destroy: vi.fn(),
      });
    vi.stubGlobal('LanguageDetector', { availability: vi.fn(async () => 'available'), create });
    vi.stubGlobal('Translator', {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => ({ translate: async () => 'Hello', destroy: vi.fn() })),
    });
    const provider = createActiveProvider({ runtimeClient: {
      sendMessage: vi.fn(async () => ({ ok: true, type: 'get-active-provider', activeProvider: 'browser' })),
    } });
    await provider.refreshSelection();
    const { editor, controller, button } = controlFor(provider);

    editor.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();
    await vi.waitFor(() => expect(controller.state.error?.userMessage).toMatch(/prepar/i));
    rejectCreation(new Error('raw browser detail'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    button.click();
    await vi.waitFor(() => expect(controller.state.error?.userMessage).toMatch(/unavailable/i));
    expect(create).toHaveBeenCalledTimes(1);
    expect(editor.value).toBe('你好');

    editor.value = 'Bonjour';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  });

  it('bounds a detector creation that never settles, detects newer text, and destroys a late model', async () => {
    vi.useFakeTimers();
    try {
      const staleDetect = vi.fn(async () => [{ detectedLanguage: 'zh', confidence: 0.99 }]);
      const staleDestroy = vi.fn();
      let finishStale!: (model: { detect: typeof staleDetect; destroy: typeof staleDestroy }) => void;
      const freshDetect = vi.fn(async () => [{ detectedLanguage: 'fr', confidence: 0.99 }]);
      const create = vi.fn()
        .mockImplementationOnce(() => new Promise((resolve) => { finishStale = resolve; }))
        .mockResolvedValue({ detect: freshDetect, destroy: vi.fn() });
      vi.stubGlobal('LanguageDetector', { availability: vi.fn(async () => 'available'), create });
      const availability = vi.fn(async () => 'available');
      vi.stubGlobal('Translator', { availability, create: vi.fn() });
      const provider = createActiveProvider({ runtimeClient: {
        sendMessage: vi.fn(async () => ({ ok: true, type: 'get-active-provider', activeProvider: 'browser' })),
      } });
      await provider.refreshSelection();

      provider.prepareInput?.('你好');
      provider.prepareInput?.('Bonjour');
      expect(create).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(30_000);

      expect(create).toHaveBeenCalledTimes(2);
      expect(freshDetect).toHaveBeenCalledWith('Bonjour', expect.any(Object));
      expect(availability).toHaveBeenCalledWith({ sourceLanguage: 'fr', targetLanguage: 'en' });
      finishStale({ detect: staleDetect, destroy: staleDestroy });
      await Promise.resolve();
      expect(staleDetect).not.toHaveBeenCalled();
      expect(staleDestroy).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('destroys a prepared local model when the prompt is cancelled before provider selection settles', async () => {
    const { translatorAvailability } = localApis();
    let completeModel!: (model: { translate: () => Promise<string>; destroy: () => void }) => void;
    const destroy = vi.fn();
    vi.stubGlobal('Translator', {
      availability: translatorAvailability,
      create: vi.fn(() => new Promise((resolve) => { completeModel = resolve; })),
    });
    let selectionCalls = 0;
    const provider = createActiveProvider({ runtimeClient: {
      sendMessage: vi.fn(() => ++selectionCalls === 1
        ? Promise.resolve({ ok: true, type: 'get-active-provider', activeProvider: 'browser' })
        : new Promise(() => undefined)),
    } });
    await provider.refreshSelection();
    provider.prepareInput?.('你好');
    await vi.waitFor(() => expect(translatorAvailability).toHaveBeenCalledOnce());
    await Promise.resolve();
    const abort = new AbortController();
    provider.beginUserAction?.({ text: '你好', targetLanguage: 'en' }, { signal: abort.signal });

    abort.abort();
    completeModel({ translate: async () => 'Hello', destroy });
    await vi.waitFor(() => expect(destroy).toHaveBeenCalledOnce());
  });

  it('coalesces rapid input while detector creation is pending and detects the latest text', async () => {
    type DetectorModel = { detect: (text: string) => Promise<Array<{ detectedLanguage: string; confidence: number }>>; destroy: () => void };
    let finishCreation!: (model: DetectorModel) => void;
    const detect = vi.fn(async (text: string) => [{
      detectedLanguage: text === 'Bonjour' ? 'fr' : 'zh', confidence: 0.99,
    }]);
    const model: DetectorModel = { detect, destroy: vi.fn() };
    let creations = 0;
    const detectorCreate = vi.fn(() => ++creations === 1
      ? new Promise<typeof model>((resolve) => { finishCreation = resolve; })
      : Promise.resolve(model));
    const translatorAvailability = vi.fn(async () => 'available');
    vi.stubGlobal('LanguageDetector', { availability: vi.fn(async () => 'downloadable'), create: detectorCreate });
    vi.stubGlobal('Translator', { availability: translatorAvailability, create: vi.fn() });
    const provider = createActiveProvider({ runtimeClient: {
      sendMessage: vi.fn(async () => ({ ok: true, type: 'get-active-provider', activeProvider: 'browser' })),
    } });
    await provider.refreshSelection();

    provider.prepareInput?.('B');
    provider.prepareInput?.('Bon');
    provider.prepareInput?.('Bonjour');
    expect(detectorCreate).toHaveBeenCalledOnce();
    finishCreation(model);
    await vi.waitFor(() => expect(translatorAvailability).toHaveBeenCalledWith({
      sourceLanguage: 'fr', targetLanguage: 'en',
    }));
    expect(detect).toHaveBeenLastCalledWith('Bonjour', expect.any(Object));
  });

  it('reports a safe local model error when Translator.create rejects during click activation', async () => {
    const { translatorAvailability } = localApis();
    vi.stubGlobal('Translator', {
      availability: translatorAvailability,
      create: vi.fn(() => { throw new Error('raw browser detail'); }),
    });
    const provider = createActiveProvider({ runtimeClient: {
      sendMessage: vi.fn(async () => ({ ok: true, type: 'get-active-provider', activeProvider: 'browser' })),
    } });
    await provider.refreshSelection();
    const { editor, controller, button } = controlFor(provider);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(translatorAvailability).toHaveBeenCalledOnce());
    await Promise.resolve();

    button.click();
    await vi.waitFor(() => expect(controller.state.status).toBe('error'));
    expect(controller.state.error?.code).toBe('MODEL_DOWNLOAD_FAILED');
    expect(controller.state.error?.userMessage).not.toContain('raw browser detail');
    expect(editor.value).toBe('你好');
  });

  it('uses the current background selection for each translation without reading storage', async () => {
    let activeProvider = 'deepseek';
    const sendMessage = vi.fn(async (message: { type: string; providerId?: string }) => {
      if (message.type === 'get-active-provider') {
        return { ok: true, type: 'get-active-provider', activeProvider };
      }
      return {
        ok: true, type: 'translate',
        result: { text: message.providerId, providerId: message.providerId },
      };
    });
    const provider = createActiveProvider({ runtimeClient: { sendMessage } });

    expect(await provider.translate({ text: '你好', targetLanguage: 'en' }))
      .toEqual({ text: 'deepseek', providerId: 'deepseek' });
    activeProvider = 'kimi';
    expect(await provider.translate({ text: 'Bonjour', targetLanguage: 'en' }))
      .toEqual({ text: 'kimi', providerId: 'kimi' });
    expect(sendMessage.mock.calls.map(([message]) => message.type)).toEqual([
      'get-active-provider', 'translate', 'get-active-provider', 'translate',
    ]);
  });

  it.each(['deepseek', 'kimi', 'ollama'] as const)('routes %s through only its runtime proxy', async (id) => {
    const sendMessage = vi.fn(async () => ({
      ok: true, type: 'translate', result: { text: 'Hello', providerId: id },
    }));
    const provider = createConfiguredProvider(
      { ...DEFAULT_SETTINGS, activeProvider: id },
      { runtimeClient: { sendMessage } },
    );

    expect(provider.id).toBe(id);
    expect(await provider.translate({ text: '你好', targetLanguage: 'en' }))
      .toEqual({ text: 'Hello', providerId: id });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'translate', providerId: id, text: '你好' });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('never falls back after the configured runtime provider fails', async () => {
    const sendMessage = vi.fn(async () => ({
      ok: false,
      error: { code: 'RATE_LIMITED', userMessage: 'Rate limited.', retryable: true },
    }));
    const provider = createConfiguredProvider(
      { ...DEFAULT_SETTINGS, activeProvider: 'deepseek' },
      { runtimeClient: { sendMessage } },
    );

    await expect(provider.translate({ text: '你好', targetLanguage: 'en' }))
      .rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ type: 'translate', providerId: 'deepseek', text: '你好' });
  });

  it('uses only the browser-local provider for browser selection', async () => {
    const sendMessage = vi.fn();
    const provider = createConfiguredProvider(DEFAULT_SETTINGS, {
      runtimeClient: { sendMessage },
      detector: { detect: async () => ({ detectedLanguage: 'zh', confidence: 0.99 }) },
      translator: {
        availability: async () => 'available',
        translate: async () => 'Hello',
      },
    });

    expect(provider.id).toBe('browser');
    expect(await provider.translate({ text: '你好', targetLanguage: 'en' }))
      .toEqual({ text: 'Hello', providerId: 'browser', sourceLanguage: 'zh' });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('reports missing document APIs through the browser-local bridge', async () => {
    const bridges = createDocumentBrowserBridges({});
    const provider = createConfiguredProvider(DEFAULT_SETTINGS, {
      runtimeClient: { sendMessage: vi.fn() }, ...bridges,
    });

    await expect(provider.translate({ text: '你好', targetLanguage: 'en' }))
      .rejects.toMatchObject({ code: 'BROWSER_API_UNAVAILABLE' });
  });
});

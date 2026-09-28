// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TranslationProvider } from '../../../../packages/core/src/contracts';
import { createEditorHandle, isSubmitEvent } from '../../src/sites/dom-editor';
import { TranslationController } from '../../src/content/translation-controller';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(
  translate: TranslationProvider['translate'] = async () => ({ text: 'Hello', providerId: 'deepseek' }),
  id: TranslationProvider['id'] = 'deepseek',
) {
  const form = document.createElement('form');
  const textarea = document.createElement('textarea');
  textarea.value = '你好';
  form.append(textarea);
  document.body.append(form);
  const editor = createEditorHandle(textarea);
  const provider: TranslationProvider = {
    id,
    availability: async () => ({ status: 'available' }),
    translate,
  };
  const controller = new TranslationController({ editor, provider, isPromptSubmitted: isSubmitEvent });
  return { form, textarea, editor, provider, controller };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('safe translation controller', () => {
  it.each(['', ' \n\t '])('rejects blank editor input without a provider call (%j)', async (text) => {
    const translate = vi.fn(async () => ({ text: 'Hello', providerId: 'deepseek' as const }));
    const { textarea, controller } = setup(translate);
    textarea.value = text;

    await controller.translate();

    expect(controller.state).toMatchObject({ status: 'error', error: { code: 'EMPTY_INPUT' } });
    expect(textarea.value).toBe(text);
    expect(translate).not.toHaveBeenCalled();
  });

  it('rejects a duplicate click while translation is pending', async () => {
    const pending = deferred<{ text: string; providerId: 'deepseek' }>();
    const translate = vi.fn(() => pending.promise);
    const { controller } = setup(translate);

    const first = controller.translate();
    const second = controller.translate();
    expect(controller.state.status).toBe('translating');
    expect(translate).toHaveBeenCalledTimes(1);
    pending.resolve({ text: 'Hello', providerId: 'deepseek' });
    await Promise.all([first, second]);
  });

  it('replaces editor text, emits states, and never submits or clicks', async () => {
    const { form, textarea, controller } = setup();
    const states: string[] = [];
    controller.subscribe((state) => states.push(state.status));
    const submitted = vi.fn();
    const clicked = vi.fn();
    form.addEventListener('submit', submitted);
    form.addEventListener('click', clicked);

    await controller.translate();

    expect(textarea.value).toBe('Hello');
    expect(states).toContain('translating');
    expect(states.at(-1)).toBe('success');
    expect(controller.state).toMatchObject({ status: 'success', canUndo: true });
    expect(submitted).not.toHaveBeenCalled();
    expect(clicked).not.toHaveBeenCalled();
  });

  it('preserves input and reports a provider failure', async () => {
    const { textarea, controller } = setup(async () => { throw new Error('secret remote detail'); });

    await controller.translate();

    expect(textarea.value).toBe('你好');
    expect(controller.state).toMatchObject({ status: 'error', error: { code: 'UNKNOWN' } });
    expect(JSON.stringify(controller.state)).not.toContain('secret remote detail');
  });

  it.each(['deepseek', 'kimi', 'ollama', 'browser'] as const)(
    'short-circuits detected English before requesting %s', async (id) => {
      const translate = vi.fn(async () => ({ text: 'Hello', providerId: id }));
      const { textarea, editor } = setup(translate, id);
      const controller = new TranslationController({
        editor,
        provider: { id, availability: async () => ({ status: 'available' }), translate },
        detector: { detect: async () => ({ detectedLanguage: 'en-US', confidence: 0.99 }) },
      });

      await controller.translate();

      expect(controller.state).toMatchObject({ status: 'error', error: { code: 'ALREADY_ENGLISH' } });
      expect(textarea.value).toBe('你好');
      expect(translate).not.toHaveBeenCalled();
    },
  );

  it('uses the document Language Detector by default for remote English preflight', async () => {
    const destroy = vi.fn();
    vi.stubGlobal('LanguageDetector', {
      availability: async () => 'available',
      create: async () => ({
        detect: async () => [{ detectedLanguage: 'en', confidence: 0.98 }],
        destroy,
      }),
    });
    const translate = vi.fn(async () => ({ text: 'Hello', providerId: 'deepseek' as const }));
    const { controller } = setup(translate);

    await controller.translate();

    expect(controller.state).toMatchObject({ status: 'error', error: { code: 'ALREADY_ENGLISH' } });
    expect(translate).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('passes a canonical non-English source tag to its single provider', async () => {
    const translate = vi.fn(async () => ({ text: 'Hello', providerId: 'kimi' as const }));
    const { editor } = setup(translate, 'kimi');
    const controller = new TranslationController({
      editor,
      provider: { id: 'kimi', availability: async () => ({ status: 'available' }), translate },
      detector: { detect: async () => ({ detectedLanguage: 'zh-cn', confidence: 0.9 }) },
    });

    await controller.translate();

    expect(translate).toHaveBeenCalledWith(
      { text: '你好', sourceLanguage: 'zh-CN', targetLanguage: 'en' },
      expect.any(Object),
    );
  });

  it.each(['deepseek', 'kimi', 'ollama'] as const)(
    'runs %s without sourceLanguage when detection is unavailable', async (id) => {
      const translate = vi.fn(async () => ({ text: 'Hello', providerId: id }));
      const { editor } = setup(translate, id);
      const controller = new TranslationController({
        editor,
        provider: { id, availability: async () => ({ status: 'available' }), translate },
        detector: { detect: async () => { throw new Error('unavailable'); } },
      });

      await controller.translate();

      expect(translate).toHaveBeenCalledWith(
        { text: '你好', targetLanguage: 'en' }, expect.any(Object),
      );
    },
  );

  it('shows browser model download progress before success', async () => {
    const { editor } = setup();
    const controller = new TranslationController({
      editor,
      provider: {
        id: 'browser', availability: async () => ({ status: 'downloadable' }),
        translate: async (_request, options) => {
          options?.onProgress?.({ kind: 'model-download', loaded: 2, total: 4 });
          return { text: 'Hello', providerId: 'browser', sourceLanguage: 'zh' };
        },
      },
      detector: { detect: async () => ({ detectedLanguage: 'zh', confidence: 0.99 }) },
    });
    const states: string[] = [];
    controller.subscribe((state) => states.push(state.status));

    await controller.translate();

    expect(states).toContain('downloading');
    expect(controller.state.status).toBe('success');
  });

  it('refuses a late result after an observed input event, even if text is restored', async () => {
    const pending = deferred<{ text: string; providerId: 'deepseek' }>();
    const { textarea, controller } = setup(() => pending.promise);
    const work = controller.translate();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    pending.resolve({ text: 'Hello', providerId: 'deepseek' });
    await work;

    expect(textarea.value).toBe('你好');
    expect(controller.state).toMatchObject({ status: 'error', error: { code: 'INPUT_CHANGED' } });
  });

  it('cancels pending work immediately when the editor receives user input', async () => {
    const pending = deferred<{ text: string; providerId: 'deepseek' }>();
    let signal: AbortSignal | undefined;
    const { textarea, controller } = setup((_request, options) => {
      signal = options?.signal;
      return pending.promise;
    });
    const work = controller.translate();

    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    expect(signal?.aborted).toBe(true);
    expect(controller.state).toMatchObject({ status: 'error', error: { code: 'INPUT_CHANGED' } });
    pending.resolve({ text: 'Hello', providerId: 'deepseek' });
    await work;
    expect(textarea.value).toBe('你好');
  });

  it('refuses a late result after an unobserved text mutation', async () => {
    const pending = deferred<{ text: string; providerId: 'deepseek' }>();
    const { textarea, controller } = setup(() => pending.promise);
    const work = controller.translate();
    textarea.value = 'newer';
    pending.resolve({ text: 'Hello', providerId: 'deepseek' });
    await work;

    expect(textarea.value).toBe('newer');
    expect(controller.state).toMatchObject({ status: 'error', error: { code: 'INPUT_CHANGED' } });
  });

  it('handles a canceled editor replacement without reporting success or creating Undo', async () => {
    const { textarea, controller } = setup();
    textarea.addEventListener('beforeinput', (event) => event.preventDefault());

    await controller.translate();

    expect(textarea.value).toBe('你好');
    expect(controller.state.status).toBe('error');
    expect(controller.undo()).toBe(false);
  });

  it('does not publish success when the host submits during replacement input', async () => {
    const { form, textarea, controller } = setup();
    textarea.addEventListener('input', () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await controller.translate();

    expect(controller.state).toMatchObject({ status: 'error', canUndo: false });
    expect(controller.undo()).toBe(false);
  });

  it('undoes one successful replacement only while the translated snapshot is still current', async () => {
    const { textarea, controller } = setup();
    await controller.translate();

    expect(controller.undo()).toBe(true);
    expect(textarea.value).toBe('你好');
    expect(controller.undo()).toBe(false);
    expect(controller.state.status).toBe('idle');
  });

  it('makes Undo available as soon as subscribers observe success', async () => {
    const { textarea, controller } = setup();
    let undone = false;
    controller.subscribe((state) => {
      if (state.status === 'success') undone = controller.undo();
    });

    await controller.translate();

    expect(undone).toBe(true);
    expect(textarea.value).toBe('你好');
  });

  it('does not send stale success to later subscribers after a listener undoes it', async () => {
    const { controller } = setup();
    controller.subscribe((state) => {
      if (state.status === 'success') controller.undo();
    });
    const observed: string[] = [];
    controller.subscribe((state) => observed.push(state.status));

    await controller.translate();

    expect(observed).toEqual(['idle', 'translating', 'idle']);
    expect(controller.state.status).toBe('idle');
  });

  it('continues translation and later notifications when a subscriber throws', async () => {
    const { textarea, controller } = setup();
    controller.subscribe((state) => {
      if (state.status === 'translating') throw new Error('UI callback failed');
    });
    const observed: string[] = [];
    controller.subscribe((state) => observed.push(state.status));

    await expect(controller.translate()).resolves.toBeUndefined();

    expect(textarea.value).toBe('Hello');
    expect(controller.state.status).toBe('success');
    expect(observed).toEqual(['idle', 'translating', 'success']);
    expect(controller.undo()).toBe(true);
  });

  it('does not report Undo success when the host rewrites the restored text', async () => {
    const { textarea, controller } = setup();
    await controller.translate();
    textarea.addEventListener('input', () => {
      if (textarea.value === '你好') textarea.value = 'host rewrite';
    });

    expect(controller.undo()).toBe(false);
    expect(textarea.value).toBe('host rewrite');
    expect(controller.state.status).toBe('error');
  });

  it.each(['input', 'submit', 'dispose', 'timeout'] as const)(
    'invalidates Undo on %s', async (reason) => {
      vi.useFakeTimers();
      const { form, textarea, controller } = setup();
      await controller.translate();
      if (reason === 'input') textarea.dispatchEvent(new Event('input', { bubbles: true }));
      if (reason === 'submit') form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      if (reason === 'dispose') controller.dispose();
      if (reason === 'timeout') vi.advanceTimersByTime(10_000);

      expect(controller.undo()).toBe(false);
    },
  );

  it('invalidates the previous Undo as soon as another translation starts', async () => {
    const pending = deferred<{ text: string; providerId: 'deepseek' }>();
    let count = 0;
    const { controller } = setup(() => ++count === 1
      ? Promise.resolve({ text: 'Hello', providerId: 'deepseek' })
      : pending.promise);
    await controller.translate();

    const second = controller.translate();

    expect(controller.state.status).toBe('translating');
    expect(controller.undo()).toBe(false);
    pending.resolve({ text: 'Hello again', providerId: 'deepseek' });
    await second;
  });

  it('ignores a late result after navigation disposal and releases subscriptions', async () => {
    const pending = deferred<{ text: string; providerId: 'deepseek' }>();
    const { textarea, controller } = setup(() => pending.promise);
    const listener = vi.fn();
    controller.subscribe(listener);
    const work = controller.translate();
    const beforeDispose = listener.mock.calls.length;
    controller.dispose();
    pending.resolve({ text: 'Hello', providerId: 'deepseek' });
    await work;

    expect(textarea.value).toBe('你好');
    expect(listener).toHaveBeenCalledTimes(beforeDispose);
  });
});

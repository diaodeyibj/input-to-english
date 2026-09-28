// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import type { TranslationProvider } from '../../../../packages/core/src/index';
import { mountForActiveEditor, startEditorObserver } from '../../src/content/mount';
import { chatgptAdapter } from '../../src/sites/chatgpt';

const stops: Array<() => void> = [];

function composer(): HTMLTextAreaElement {
  const main = document.createElement('main');
  const form = document.createElement('form');
  form.setAttribute('data-testid', 'prompt-form');
  const editor = document.createElement('textarea');
  editor.setAttribute('aria-label', 'Message ChatGPT');
  form.append(editor);
  main.append(form);
  document.body.append(main);
  return editor;
}

function provider(): TranslationProvider {
  return {
    id: 'browser',
    availability: async () => ({ status: 'available' }),
    testConnection: async () => ({ ok: true, detail: 'Ready' }),
    translate: async () => ({ text: 'Hello', providerId: 'browser', sourceLanguage: 'zh' }),
  };
}

async function settleMutations(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  window.history.replaceState(null, '', '/');
});

describe('content editor mounting', () => {
  it('marks one control and reuses it for repeated passes on the same editor', () => {
    composer();
    const dependencies = { provider: provider() };

    const first = mountForActiveEditor(document, chatgptAdapter, dependencies);
    if (first) stops.push(() => first.dispose());
    const second = mountForActiveEditor(document, chatgptAdapter, dependencies);

    expect(second).toBe(first);
    expect(document.querySelectorAll('[data-input-to-english-root="v1"]')).toHaveLength(1);
    expect(first?.control.element.parentElement).toBe(document.querySelector('form'));
  });

  it('coalesces mutation batches and replaces the mount after editor recreation', async () => {
    const editor = composer();
    const stop = startEditorObserver(document, chatgptAdapter, { provider: provider() });
    stops.push(stop);
    const firstRoot = document.querySelector('[data-input-to-english-root="v1"]');
    expect(firstRoot).not.toBeNull();

    editor.setAttribute('data-test', 'a');
    editor.setAttribute('data-test', 'b');
    await settleMutations();
    expect(document.querySelectorAll('[data-input-to-english-root="v1"]')).toHaveLength(1);
    expect(document.querySelector('[data-input-to-english-root="v1"]')).toBe(firstRoot);

    const replacement = editor.cloneNode() as HTMLTextAreaElement;
    editor.replaceWith(replacement);
    await settleMutations();
    expect(firstRoot?.isConnected).toBe(false);
    expect(document.querySelectorAll('[data-input-to-english-root="v1"]')).toHaveLength(1);
    expect(document.querySelector('[data-input-to-english-root="v1"]')).not.toBe(firstRoot);
  });

  it('disposes the control when its editor disappears and remounts a later editor', async () => {
    const editor = composer();
    const stop = startEditorObserver(document, chatgptAdapter, { provider: provider() });
    stops.push(stop);
    const firstRoot = document.querySelector('[data-input-to-english-root="v1"]');

    editor.closest('main')?.remove();
    await settleMutations();
    expect(firstRoot?.isConnected).toBe(false);
    expect(document.querySelector('[data-input-to-english-root="v1"]')).toBeNull();

    composer();
    await settleMutations();
    expect(document.querySelectorAll('[data-input-to-english-root="v1"]')).toHaveLength(1);
  });

  it('invalidates Undo on submission and on same-editor navigation', async () => {
    const editor = composer();
    editor.value = '你好';
    const stop = startEditorObserver(document, chatgptAdapter, { provider: provider() });
    stops.push(stop);
    const root = document.querySelector<HTMLElement>('[data-input-to-english-root="v1"]')!;
    const translate = root.shadowRoot!.querySelector<HTMLButtonElement>('button[aria-label="Translate prompt to English"]')!;
    translate.click();
    await settleMutations();
    expect(editor.value).toBe('Hello');
    expect(root.shadowRoot!.querySelector<HTMLButtonElement>('button[aria-label="Restore original prompt"]')!.hidden).toBe(false);

    editor.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(root.shadowRoot!.querySelector<HTMLButtonElement>('button[aria-label="Restore original prompt"]')!.hidden).toBe(true);

    editor.value = '再见';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    translate.click();
    await settleMutations();
    expect(root.shadowRoot!.querySelector<HTMLButtonElement>('button[aria-label="Restore original prompt"]')!.hidden).toBe(false);
    window.history.pushState(null, '', '/new-chat');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await settleMutations();
    expect(root.isConnected).toBe(false);
    const nextRoot = document.querySelector<HTMLElement>('[data-input-to-english-root="v1"]')!;
    expect(nextRoot).not.toBe(root);
    expect(nextRoot.shadowRoot!.querySelector<HTMLButtonElement>('button[aria-label="Restore original prompt"]')!.hidden).toBe(true);
  });

  it('disconnects its observer and listeners when stopped', async () => {
    const editor = composer();
    const stop = startEditorObserver(document, chatgptAdapter, { provider: provider() });
    stops.push(stop);
    const root = document.querySelector<HTMLElement>('[data-input-to-english-root="v1"]')!;
    stop();
    expect(root.isConnected).toBe(false);

    editor.replaceWith(editor.cloneNode());
    window.dispatchEvent(new PopStateEvent('popstate'));
    await settleMutations();
    expect(document.querySelector('[data-input-to-english-root="v1"]')).toBeNull();
  });

  it('does not mount when adapter cannot find an eligible editor or anchor', () => {
    const editor = composer();
    editor.disabled = true;
    expect(mountForActiveEditor(document, chatgptAdapter, { provider: provider() })).toBeNull();
    expect(document.querySelector('[data-input-to-english-root="v1"]')).toBeNull();
  });
});

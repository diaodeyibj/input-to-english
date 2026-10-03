// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import type { TranslationProvider } from '../../../../packages/core/src/index';
import { mountForActiveEditor, startEditorObserver } from '../../src/content/mount';
import { chatgptAdapter } from '../../src/sites/chatgpt';
import { selectSiteAdapter } from '../../src/sites/select-adapter';

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
  it('positions the Gemini control beside the prompt when its fieldset has static positioning', () => {
    document.body.innerHTML = '<main><input-container><div class="input-area-container" style="position:absolute;top:300px;left:200px"><fieldset class="input-area-fieldset"><input-area-v2><rich-textarea><div class="ql-editor" role="textbox" contenteditable="true" tabindex="0">你好</div></rich-textarea></input-area-v2></fieldset></div></input-container></main>';
    const fieldset = document.querySelector<HTMLElement>('.input-area-fieldset')!;
    const editor = document.querySelector<HTMLElement>('.ql-editor')!;
    const mounted = mountForActiveEditor(document, selectSiteAdapter('gemini.google.com')!, { provider: provider() }, editor)!;
    expect(mounted).not.toBeNull();
    expect(window.getComputedStyle(fieldset).position).toBe('relative');
    expect(mounted.control.element.style.position).toBe('absolute');
    expect(mounted.control.element.style.right).toBe('8px');
    expect(mounted.control.element.style.bottom).toBe('calc(100% + 6px)');
    mounted.dispose();
    expect(fieldset.style.position).toBe('');
  });

  it('anchors Gemini to the actual input area instead of its separately positioned page-bottom shell', async () => {
    document.body.innerHTML = '<main><input-container style="position:relative;top:667px"><div class="input-area-container" style="position:absolute;top:-339px"><fieldset class="input-area-fieldset" style="position:relative"><input-area-v2><div class="text-input-field" style="overflow:hidden;height:40px"><rich-textarea><div class="ql-editor" role="textbox" contenteditable="true" tabindex="0">你好</div></rich-textarea></div><div data-test-id="send-button-container"><button>Send</button></div></input-area-v2></fieldset></div></input-container></main>';
    const editor = document.querySelector<HTMLElement>('.ql-editor')!;
    stops.push(startEditorObserver(document, selectSiteAdapter('gemini.google.com')!, { provider: provider() }));
    editor.focus();
    const root = document.querySelector<HTMLElement>('[data-input-to-english-root]')!;
    expect(root.parentElement).toBe(document.querySelector('.input-area-fieldset'));
    expect(root.style.position).toBe('absolute');
    expect(root.style.right).toBe('8px');
    expect(root.style.bottom).toBe('calc(100% + 6px)');
    expect(root.closest('.text-input-field')).toBeNull();
    const replacement = editor.cloneNode(true) as HTMLElement;
    editor.replaceWith(replacement);
    replacement.focus();
    await settleMutations();
    expect(document.querySelectorAll('[data-input-to-english-root]')).toHaveLength(1);
    expect(root.isConnected).toBe(false);
  });

  it('rejects a late result after history changes even before navigation reconciliation', async () => {
    const editor = composer();
    editor.value = '你好';
    let resolve!: (result: { text: string; providerId: 'browser' }) => void;
    const pending = new Promise<{ text: string; providerId: 'browser' }>(yes => { resolve = yes; });
    stops.push(startEditorObserver(document, chatgptAdapter, { provider: { ...provider(), translate: () => pending } }));
    document.querySelector<HTMLElement>('[data-input-to-english-root]')!.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
    await settleMutations();
    window.history.pushState(null, '', '/different-conversation');
    resolve({ text: 'Hello', providerId: 'browser' });
    await settleMutations();
    expect(editor.value).toBe('你好');
  });

  it('does not reclaim the editor when focus moved to a page control during translation', async () => {
    document.body.innerHTML = '<main><section><div role="textbox" contenteditable="true" tabindex="0" data-testid="tweetTextarea_0">你好</div><button data-testid="tweetButton">Post</button></section><button id="elsewhere">Other page action</button></main>';
    let resolve!: (result: { text: string; providerId: 'browser' }) => void;
    const pending = new Promise<{ text: string; providerId: 'browser' }>(yes => { resolve = yes; });
    stops.push(startEditorObserver(document, selectSiteAdapter('x.com')!, { provider: { ...provider(), translate: () => pending } }));
    const editor = document.querySelector<HTMLElement>('[contenteditable]')!; editor.focus();
    const root = document.querySelector<HTMLElement>('[data-input-to-english-root]')!;
    root.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
    await settleMutations();
    const other = document.querySelector<HTMLButtonElement>('#elsewhere')!; other.focus();
    resolve({ text: 'Hello', providerId: 'browser' });
    await settleMutations(); await settleMutations();
    expect(document.activeElement).toBe(other);
    expect(editor.textContent).toBe('你好');
    expect(root.shadowRoot!.querySelector('[role="alert"]')!.textContent).toContain('prompt changed');
  });

  it('waits for focus on X, follows thread entries and keeps its target while clicking its own control', async () => {
    document.body.innerHTML = '<main><section><div role="textbox" contenteditable="true" tabindex="0" data-testid="tweetTextarea_0">你好</div><div role="textbox" contenteditable="true" tabindex="0" data-testid="tweetTextarea_1">第二条</div><button data-testid="tweetButton">Post</button></section></main>';
    const adapter = selectSiteAdapter('x.com')!;
    const editors = document.querySelectorAll<HTMLElement>('[contenteditable]');
    stops.push(startEditorObserver(document, adapter, { provider: provider() }));
    expect(document.querySelector('[data-input-to-english-root]')).toBeNull();
    editors[0].focus();
    const first = document.querySelector<HTMLElement>('[data-input-to-english-root]')!;
    expect(first).not.toBeNull();
    first.shadowRoot!.querySelector<HTMLButtonElement>('button')!.focus();
    await settleMutations();
    expect(document.querySelector('[data-input-to-english-root]')).toBe(first);
    editors[1].focus();
    expect(first.isConnected).toBe(false);
    expect(document.querySelectorAll('[data-input-to-english-root]')).toHaveLength(1);
  });

  it('synchronously cancels a pending translation when focus switches before its continuation runs', async () => {
    document.body.innerHTML = '<main><section><div role="textbox" contenteditable="true" tabindex="0" data-testid="tweetTextarea_0">你好</div><div role="textbox" contenteditable="true" tabindex="0" data-testid="tweetTextarea_1">第二条</div><button data-testid="tweetButton">Post</button></section></main>';
    let resolve!: (result: { text: string; providerId: 'browser' }) => void;
    const pending = new Promise<{ text: string; providerId: 'browser' }>(yes => { resolve = yes; });
    stops.push(startEditorObserver(document, selectSiteAdapter('x.com')!, { provider: { ...provider(), translate: () => pending } }));
    const editors = document.querySelectorAll<HTMLElement>('[contenteditable]');
    editors[0].focus();
    document.querySelector<HTMLElement>('[data-input-to-english-root]')!.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
    await settleMutations();
    resolve({ text: 'Hello', providerId: 'browser' });
    editors[1].focus();
    await settleMutations();
    expect(editors[0].textContent).toBe('你好');
    expect(editors[1].textContent).toBe('第二条');
  });

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

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNativeEditorHandle } from '../../src/sites/dom-editor';

function installClipboardApi() {
  class Transfer {
    private data = new Map<string, string>();
    setData(type: string, value: string) { this.data.set(type, value); }
    getData(type: string) { return this.data.get(type === 'text' ? 'text/plain' : type) ?? ''; }
  }
  class Paste extends Event {
    readonly clipboardData: Transfer;
    constructor(type: string, options: EventInit & { clipboardData: Transfer }) {
      super(type, options); this.clipboardData = options.clipboardData;
    }
  }
  vi.stubGlobal('DataTransfer', Transfer);
  vi.stubGlobal('ClipboardEvent', Paste);
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); Reflect.deleteProperty(document, 'execCommand'); document.body.replaceChildren(); });

function fixture(html = '<p>原文</p>') {
  document.body.innerHTML = `<section><div contenteditable="true">${html}</div><aside data-attachment="keep">附件</aside></section>`;
  const element = document.querySelector<HTMLElement>('[contenteditable]')!;
  return { element, handle: createNativeEditorHandle(element) };
}

describe('framework-owned rich editor writes', () => {
  it('uses the host paste handler so Draft blocks survive replacement and Undo', async () => {
    installClipboardApi();
    const { element } = fixture('<div data-contents="true"><div data-block="true"><span data-text="true">原文</span></div></div>');
    const handle = createNativeEditorHandle(element, 'paste');
    element.addEventListener('paste', event => {
      event.preventDefault();
      const text = (event as ClipboardEvent).clipboardData!.getData('text/plain');
      const block = element.querySelector('[data-block]')!;
      block.textContent = text;
    });
    await handle.replaceText('English');
    expect(element.querySelector('[data-contents]')).not.toBeNull();
    expect(handle.readText()).toBe('English');
    await handle.replaceText('原文');
    expect(handle.readText()).toBe('原文');
  });

  it('waits for a host paste render and refuses a host that does not accept paste', async () => {
    installClipboardApi();
    const { element } = fixture();
    const handle = createNativeEditorHandle(element, 'paste');
    await expect(Promise.resolve().then(() => handle.replaceText('ignored'))).rejects.toThrow();
    expect(handle.readText()).toBe('原文');
    element.addEventListener('paste', event => {
      event.preventDefault();
      const text = (event as ClipboardEvent).clipboardData!.getData('text/plain');
      queueMicrotask(() => { element.textContent = text; });
    });
    await handle.replaceText('English');
    expect(handle.readText()).toBe('English');
  });

  it('accepts a full selection normalized by Draft to text leaf boundaries', async () => {
    installClipboardApi();
    const { element } = fixture('<div data-contents="true"><div data-block="true"><span data-text="true">原文</span></div></div>');
    const handle = createNativeEditorHandle(element, 'paste');
    const normalize = () => {
      const leaf = element.querySelector('[data-text]')!.firstChild!;
      const range = document.createRange(); range.setStart(leaf, 0); range.setEnd(leaf, 2);
      const selection = document.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    };
    document.addEventListener('selectionchange', normalize, { once: true });
    element.addEventListener('paste', event => {
      event.preventDefault(); element.querySelector('[data-text]')!.textContent = 'English';
    });
    await handle.replaceText('English');
    expect(handle.readText()).toBe('English');
  });

  it('waits for a deferred host render rather than rejecting after one timer turn', async () => {
    installClipboardApi();
    const { element } = fixture();
    const handle = createNativeEditorHandle(element, 'paste');
    element.addEventListener('paste', event => {
      event.preventDefault(); setTimeout(() => { element.textContent = 'English'; }, 25);
    });
    await handle.replaceText('English');
    expect(handle.readText()).toBe('English');
  });

  it('restores the prior caret when a host ignores paste', async () => {
    installClipboardApi();
    const { element } = fixture(); element.focus();
    const leaf = element.firstChild!.firstChild!;
    document.getSelection()!.collapse(leaf, 1);
    const handle = createNativeEditorHandle(element, 'paste');
    await expect(handle.replaceText('English')).rejects.toThrow();
    expect(document.getSelection()!.isCollapsed).toBe(true);
    expect(document.getSelection()!.anchorNode).toBe(leaf);
    expect(document.getSelection()!.anchorOffset).toBe(1);
  });

  it('waits for Quill to normalize native edits without invoking its legacy clipboard', async () => {
    const { element } = fixture();
    const handle = createNativeEditorHandle(element, 'quill');
    const paste = vi.fn();
    element.addEventListener('paste', paste);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: (_command: string, _ui: boolean, text: string) => {
      element.textContent = text;
      queueMicrotask(() => { const paragraph = document.createElement('p'); paragraph.textContent = text; element.replaceChildren(paragraph); });
      return true;
    } });
    await handle.replaceText('English');
    expect(element.firstElementChild?.tagName).toBe('P');
    expect(handle.readText()).toBe('English');
    expect(paste).not.toHaveBeenCalled();
  });

  it('keeps the current draft if the action is cancelled during focus', async () => {
    installClipboardApi();
    const { element } = fixture();
    const handle = createNativeEditorHandle(element, 'paste');
    let current = true;
    element.addEventListener('focus', () => { current = false; });
    element.addEventListener('paste', event => { event.preventDefault(); element.textContent = 'unexpected'; });
    await expect(Promise.resolve().then(() => handle.replaceText('English', () => current))).rejects.toThrow();
    expect(handle.readText()).toBe('原文');
  });

  it('does not paste if the user moves the caret during framework selection settling', async () => {
    installClipboardApi();
    const { element } = fixture();
    const handle = createNativeEditorHandle(element, 'paste');
    const paste = vi.fn((event: Event) => { event.preventDefault(); element.textContent = 'unexpected'; });
    element.addEventListener('paste', paste);
    const writing = handle.replaceText('English');
    const selection = document.getSelection()!;
    selection.collapse(element.firstChild!.firstChild, 0);
    await expect(writing).rejects.toThrow();
    expect(paste).not.toHaveBeenCalled();
    expect(handle.readText()).toBe('原文');
  });

  it('preserves newer typing while a paste render settles', async () => {
    installClipboardApi();
    const { element } = fixture();
    const handle = createNativeEditorHandle(element, 'paste');
    element.addEventListener('paste', event => {
      event.preventDefault(); element.textContent = 'English';
      queueMicrotask(() => {
        element.textContent = 'English plus user text';
        element.dispatchEvent(new InputEvent('input', { bubbles: true }));
      });
    });
    await expect(handle.replaceText('English')).rejects.toMatchObject({ original: '原文' });
    expect(handle.readText()).toBe('English plus user text');
  });

  it('stops before insertion if focusing synchronously changes the user draft', () => {
    const { element, handle } = fixture();
    element.addEventListener('focus', () => { element.textContent = 'newer user input'; });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: (_command: string, _ui: boolean, text: string) => {
      element.textContent = text; return true;
    } });
    expect(() => handle.replaceText('English')).toThrow();
    expect(handle.readText()).toBe('newer user input');
  });

  it('does not issue a synthetic edit before the framework receives the native replacement', () => {
    const { element, handle } = fixture();
    element.addEventListener('beforeinput', event => {
      if (!event.isTrusted) element.textContent = 'unexpected synthetic edit';
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: (_command: string, _ui: boolean, text: string) => {
      element.textContent = text;
      element.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return true;
    } });
    handle.replaceText('English');
    expect(handle.readText()).toBe('English');
  });

  it('reads real Draft nested blocks without adding extra blank lines', () => {
    const { handle } = fixture('<div data-contents="true"><div data-block="true"><div class="public-DraftStyleDefault-block"><span><span data-text="true">你好 @alice 👩🏽‍💻</span></span></div></div><div data-block="true"><div><span><br data-text="true"></span></div></div><div data-block="true"><div><span><span data-text="true">再见</span></span></div></div></div>');
    expect(handle.readText()).toBe('你好 @alice 👩🏽‍💻\n\n再见');
  });

  it('keeps the original when native editing is unavailable', () => {
    const { element, handle } = fixture();
    expect(() => handle.replaceText('English')).toThrow();
    expect(element.innerHTML).toBe('<p>原文</p>');
  });

  it('refuses embedded noneditable content before attempting a replacement', () => {
    const { element, handle } = fixture('<p>原文<span contenteditable="false">文件 chip</span></p>');
    expect(() => handle.replaceText('English')).toThrow();
    expect(element.innerHTML).toContain('文件 chip');
    expect(handle.readText()).toBe('原文文件 chip');
  });

  it('selects only its own editable text and leaves surrounding attachments alone', () => {
    const { element, handle } = fixture();
    const attachment = document.querySelector('aside');
    // jsdom has no browser editing engine; model only that external boundary.
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn((command, _ui, text) => {
      expect(command).toBe('insertText');
      const selection = document.getSelection()!;
      const range = selection.getRangeAt(0);
      expect(range.commonAncestorContainer).toBe(element);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      return true;
    }) });
    handle.replaceText('English\nnext');
    expect(handle.readText()).toBe('English\nnext');
    expect(handle.getRevision()).toBe(1);
    expect(document.querySelector('aside')).toBe(attachment);
    expect(attachment?.textContent).toBe('附件');
    Reflect.deleteProperty(document, 'execCommand');
  });
});

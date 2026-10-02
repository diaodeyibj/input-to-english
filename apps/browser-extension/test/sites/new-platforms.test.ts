// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { selectSiteAdapter } from '../../src/sites/select-adapter';

afterEach(() => { document.body.replaceChildren(); });

describe('Gemini and X composers', () => {
  it.each(['gemini.google.com', 'x.com'])('routes only the exact %s origin', (host) => {
    expect(selectSiteAdapter(host)?.id).toBe(host === 'x.com' ? 'x' : 'gemini');
    expect(selectSiteAdapter(`${host}.evil.test`)).toBeNull();
    expect(selectSiteAdapter(`other.${host}`)).toBeNull();
  });

  it('requires a focused Gemini prompt and ignores its hidden clipboard', () => {
    document.body.innerHTML = '<main><input-container><input-area><rich-textarea><div class="ql-editor" contenteditable="true" role="textbox"><p>你好</p></div><div class="ql-clipboard" contenteditable="true"></div></rich-textarea><button class="send-button">Send</button></input-area></input-container></main>';
    const adapter = selectSiteAdapter('gemini.google.com')!;
    const element = document.querySelector<HTMLElement>('.ql-editor')!;
    expect(adapter.findEditor(document)).toBeNull();
    expect(adapter.findEditor(document, document.querySelector('.ql-clipboard'))).toBeNull();
    const editor = adapter.findEditor(document, element)!;
    expect(editor.readText()).toBe('你好');
    expect(adapter.findControlAnchor(editor)?.tagName).toBe('INPUT-AREA');
    expect(adapter.findControlAnchor(editor)?.closest('[contenteditable="true"]')).toBeNull();
  });

  it('selects the focused X thread entry without touching quoted text or another composer', () => {
    document.body.innerHTML = '<main><section><div data-testid="tweetTextarea_0" role="textbox" contenteditable="true">首页</div><button data-testid="tweetButtonInline">Post</button></section><div role="dialog"><article>被引用的原文</article><div data-testid="tweetTextarea_0" role="textbox" contenteditable="true">附言</div><div data-testid="tweetTextarea_1" role="textbox" contenteditable="true"><span>第二条</span></div><button data-testid="tweetButton">Post all</button></div></main>';
    const adapter = selectSiteAdapter('x.com')!;
    const element = document.querySelector<HTMLElement>('[data-testid="tweetTextarea_1"]')!;
    expect(adapter.findEditor(document)).toBeNull();
    expect(adapter.findEditor(document, document.querySelector('article'))).toBeNull();
    const editor = adapter.findEditor(document, element.firstElementChild)!;
    expect(editor.element).toBe(element);
    expect(editor.readText()).toBe('第二条');
    const foreign = document.querySelector<HTMLButtonElement>('[data-testid="tweetButtonInline"]')!;
    const own = document.querySelector<HTMLButtonElement>('[data-testid="tweetButton"]')!;
    let foreignSubmission = true;
    let ownSubmission = false;
    foreign.addEventListener('click', e => { foreignSubmission = adapter.isPromptSubmitted(e, editor); });
    own.addEventListener('click', e => { ownSubmission = adapter.isPromptSubmitted(e, editor); });
    foreign.click(); own.click();
    expect(foreignSubmission).toBe(false);
    expect(ownSubmission).toBe(true);
  });

  it('ignores X DM and Grok routes even if an editable resembles a tweet', () => {
    document.body.innerHTML = '<main><div data-testid="tweetTextarea_0" contenteditable="true" role="textbox"></div><button data-testid="tweetButton">Post</button></main>';
    const adapter = selectSiteAdapter('x.com')!;
    const element = document.querySelector<HTMLElement>('[contenteditable]')!;
    for (const path of ['/messages', '/messages/123', '/i/chat/123', '/i/grok', '/grok']) {
      window.history.replaceState(null, '', path);
      expect(adapter.findEditor(document, element)).toBeNull();
    }
    window.history.replaceState(null, '', '/');
  });

  it('does not interpret X Enter, Shift Enter or IME as sending', () => {
    document.body.innerHTML = '<main><section><div data-testid="tweetTextarea_0" contenteditable="true" role="textbox"></div><button data-testid="tweetButtonInline">Post</button></section></main>';
    const adapter = selectSiteAdapter('x.com')!;
    const element = document.querySelector<HTMLElement>('[contenteditable]')!;
    const editor = adapter.findEditor(document, element)!;
    const results: boolean[] = [];
    element.addEventListener('keydown', e => results.push(adapter.isPromptSubmitted(e, editor)));
    for (const extra of [{}, { shiftKey: true }, { isComposing: true, ctrlKey: true }, { ctrlKey: true }]) {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ...extra }));
    }
    expect(results).toEqual([false, false, false, true]);
  });
});

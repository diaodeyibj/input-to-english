// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { claudeAdapter } from '../../src/sites/claude';
import { selectSiteAdapter } from '../../src/sites/select-adapter';

afterEach(() => { document.body.replaceChildren(); });

describe('Claude adapter', () => {
  it('selects only the exact Claude hostname', () => {
    expect(selectSiteAdapter('claude.ai')).toBe(claudeAdapter);
    expect(selectSiteAdapter('evil-claude.ai')).toBeNull();
    expect(selectSiteAdapter('claude.ai.evil.test')).toBeNull();
  });

  it('finds its primary chat input and anchors to that wrapper', () => {
    document.body.innerHTML = '<div class="ProseMirror" contenteditable="true"></div><div data-testid="chat-input"><div class="ProseMirror" contenteditable="true"></div></div>';
    const handle = claudeAdapter.findEditor(document);
    expect(handle?.element.closest('[data-testid="chat-input"]')).not.toBeNull();
    expect(claudeAdapter.findControlAnchor(handle!)).toBe(handle?.element.closest('[data-testid="chat-input"]'));
  });

  it('finds a composer when chat-input is on the editor itself and anchors outside it', () => {
    document.body.innerHTML = '<main><div id="composer"><div id="editor-layer"><div data-testid="chat-input" class="tiptap ProseMirror" contenteditable="true"></div></div></div></main>';
    const handle = claudeAdapter.findEditor(document);
    expect(handle?.element.getAttribute('data-testid')).toBe('chat-input');
    expect(claudeAdapter.findControlAnchor(handle!)).toBe(document.querySelector('#composer'));
  });

  it('uses only a composer scoped fallback', () => {
    document.body.innerHTML = '<div class="ProseMirror" contenteditable="true"></div><main><form><fieldset><div class="ProseMirror" contenteditable="true"></div></fieldset></form></main>';
    expect(claudeAdapter.findEditor(document)?.element.closest('fieldset')).not.toBeNull();
    document.body.innerHTML = '<div class="ProseMirror" contenteditable="true"></div>';
    expect(claudeAdapter.findEditor(document)).toBeNull();
  });

  it('finds a current form-contained contenteditable without the ProseMirror class', () => {
    document.body.innerHTML = '<main><form><fieldset><div data-placeholder="Message Claude" contenteditable="true"></div></fieldset></form></main>';
    expect(claudeAdapter.findEditor(document)?.element.getAttribute('data-placeholder')).toBe('Message Claude');
  });

  it('finds the current standalone composer by its placeholder', () => {
    document.body.innerHTML = '<main><div data-placeholder="Message Claude" contenteditable="true"></div></main>';
    expect(claudeAdapter.findEditor(document)?.element.getAttribute('data-placeholder')).toBe('Message Claude');
  });

  it('ignores a rich text editor in an unrelated fieldset', () => {
    document.body.innerHTML = '<aside><fieldset><div class="ProseMirror" contenteditable="true"></div></fieldset></aside>';
    expect(claudeAdapter.findEditor(document)).toBeNull();
  });

  it('ignores an unmarked ProseMirror editor outside a Claude composer', () => {
    document.body.innerHTML = '<main><section><div class="ProseMirror" contenteditable="true"></div></section></main>';
    expect(claudeAdapter.findEditor(document)).toBeNull();
  });

  it('rejects non-editable and hidden composer candidates', () => {
    document.body.innerHTML = '<div data-testid="chat-input"><div class="ProseMirror" contenteditable="false"></div></div><fieldset hidden><div class="ProseMirror" contenteditable="true"></div></fieldset>';
    expect(claudeAdapter.findEditor(document)).toBeNull();
  });

  it('recognizes submission and ignores multiline Enter', () => {
    expect(claudeAdapter.isPromptSubmitted(new Event('submit'))).toBe(true);
    expect(claudeAdapter.isPromptSubmitted(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(true);
    expect(claudeAdapter.isPromptSubmitted(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }))).toBe(false);
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { chatgptAdapter } from '../../src/sites/chatgpt';
import { selectSiteAdapter } from '../../src/sites/select-adapter';

afterEach(() => { document.body.replaceChildren(); });

describe('ChatGPT adapter', () => {
  it('selects only the exact ChatGPT hostname', () => {
    expect(selectSiteAdapter('chatgpt.com')).toBe(chatgptAdapter);
    expect(selectSiteAdapter('evil-chatgpt.com')).toBeNull();
    expect(selectSiteAdapter('chatgpt.com.evil.test')).toBeNull();
    expect(selectSiteAdapter('example.com')).toBeNull();
  });

  it('finds the prompt ID inside its composer and anchors to the form', () => {
    document.body.innerHTML = '<div contenteditable="true" id="profile-editor"></div><main><form data-testid="prompt-form"><div id="prompt-textarea" contenteditable="true"></div></form></main>';
    const handle = chatgptAdapter.findEditor(document);
    expect(handle?.element.id).toBe('prompt-textarea');
    expect(chatgptAdapter.findControlAnchor(handle!)).toBe(handle?.element.closest('form'));
  });

  it('uses a scoped textarea fallback but ignores unrelated editables', () => {
    document.body.innerHTML = '<textarea id="search"></textarea><main><form data-testid="prompt-form"><textarea aria-label="Message ChatGPT"></textarea></form></main>';
    expect(chatgptAdapter.findEditor(document)?.element.getAttribute('aria-label')).toBe('Message ChatGPT');
    document.body.innerHTML = '<div contenteditable="true" id="profile-editor"></div><textarea id="search"></textarea>';
    expect(chatgptAdapter.findEditor(document)).toBeNull();
  });

  it('finds a current composer contenteditable without the legacy prompt ID', () => {
    document.body.innerHTML = '<main><form><div data-lexical-editor="true" contenteditable="true"></div></form></main>';
    expect(chatgptAdapter.findEditor(document)?.element.getAttribute('data-lexical-editor')).toBe('true');
  });

  it('reuses a live element handle and gives a recreated editor a fresh handle', () => {
    document.body.innerHTML = '<main><form data-testid="prompt-form"><div id="prompt-textarea" contenteditable="true"></div></form></main>';
    const first = chatgptAdapter.findEditor(document)!;
    first.element.dispatchEvent(new Event('input', { bubbles: true }));
    expect(chatgptAdapter.findEditor(document)).toBe(first);
    first.element.replaceWith(first.element.cloneNode());
    const second = chatgptAdapter.findEditor(document)!;
    expect(second).not.toBe(first);
    expect(second.getRevision()).toBe(0);
    expect(second.element.isConnected).toBe(true);
  });

  it('recognizes submit and unmodified Enter without counting composition', () => {
    expect(chatgptAdapter.isPromptSubmitted(new Event('submit'))).toBe(true);
    expect(chatgptAdapter.isPromptSubmitted(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(true);
    expect(chatgptAdapter.isPromptSubmitted(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }))).toBe(false);
    expect(chatgptAdapter.isPromptSubmitted(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }))).toBe(false);
  });
});

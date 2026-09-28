// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { createEditorHandle } from '../../src/sites/dom-editor';

afterEach(() => { document.body.replaceChildren(); });

describe('DOM editor handle', () => {
  it('reads textarea values with exact line endings', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'first\nsecond\n';
    document.body.append(textarea);
    expect(createEditorHandle(textarea).readText()).toBe('first\nsecond\n');
  });

  it('reads ProseMirror paragraphs and explicit breaks as lines', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.innerHTML = '<p>first<br>middle</p><p>second</p>';
    document.body.append(editor);
    expect(createEditorHandle(editor).readText()).toBe('first\nmiddle\nsecond');
  });

  it('preserves blank and trailing ProseMirror paragraphs exactly', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.className = 'ProseMirror';
    editor.innerHTML = '<p><br></p><p>middle</p><p><br></p>';
    document.body.append(editor);
    expect(createEditorHandle(editor).readText()).toBe('\nmiddle\n');
  });

  it('replaces a textarea through bubbling input events and advances revision', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'old';
    document.body.append(textarea);
    const handle = createEditorHandle(textarea);
    const events: string[] = [];
    document.body.addEventListener('beforeinput', () => events.push('beforeinput'), { once: true });
    document.body.addEventListener('input', () => events.push('input'), { once: true });

    expect(handle.getRevision()).toBe(0);
    handle.replaceText('new\nline');

    expect(textarea.value).toBe('new\nline');
    expect(events).toEqual(['beforeinput', 'input']);
    expect(handle.getRevision()).toBe(1);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(handle.getRevision()).toBe(2);
  });

  it('inserts contenteditable output as text, never HTML', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    document.body.append(editor);
    const handle = createEditorHandle(editor);
    const events: string[] = [];
    document.body.addEventListener('beforeinput', () => events.push('beforeinput'), { once: true });
    document.body.addEventListener('input', () => events.push('input'), { once: true });

    handle.replaceText('<img src=x onerror=alert(1)>\nnext');

    expect(handle.readText()).toBe('<img src=x onerror=alert(1)>\nnext');
    expect(editor.querySelector('img')).toBeNull();
    expect(events).toEqual(['beforeinput', 'input']);
    expect(handle.getRevision()).toBe(1);
  });

  it('keeps a ProseMirror paragraph structure when replacing multiline text', () => {
    const editor = document.createElement('div');
    editor.className = 'ProseMirror';
    editor.contentEditable = 'true';
    editor.innerHTML = '<p>old</p>';
    document.body.append(editor);
    const handle = createEditorHandle(editor);

    handle.replaceText('first\n\nlast\n');

    expect(Array.from(editor.children).map((child) => child.tagName)).toEqual(['P', 'P', 'P', 'P']);
    expect(handle.readText()).toBe('first\n\nlast\n');
  });

  it('respects canceled beforeinput and keeps the original text', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'original';
    document.body.append(textarea);
    const handle = createEditorHandle(textarea);
    textarea.addEventListener('beforeinput', (event) => event.preventDefault());

    handle.replaceText('replacement');

    expect(handle.readText()).toBe('original');
    expect(handle.getRevision()).toBe(0);
  });
});

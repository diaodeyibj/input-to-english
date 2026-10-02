import { createEditorHandle, isEligibleEditor, isSubmitEvent } from './dom-editor';
import type { EditorHandle, SiteAdapter } from './editor-adapter';

const SELECTORS = [
  '[data-testid="chat-input"].ProseMirror[contenteditable="true"]',
  '[data-testid="chat-input"] .ProseMirror[contenteditable="true"]',
  'main form fieldset .ProseMirror[contenteditable="true"]',
  'main form fieldset [contenteditable="true"]',
  'main [contenteditable="true"][data-placeholder]',
];

export const claudeAdapter: SiteAdapter = {
  id: 'claude',
  findEditor(document) {
    for (const selector of SELECTORS) {
      for (const candidate of document.querySelectorAll(selector)) {
        if (isEligibleEditor(candidate)) return createEditorHandle(candidate);
      }
    }
    return null;
  },
  findControlAnchor(editor: EditorHandle) {
    const chatInput = editor.element.closest<HTMLElement>('[data-testid="chat-input"]');
    return chatInput === editor.element
      ? editor.element.parentElement?.parentElement ?? editor.element.parentElement
      : chatInput ?? editor.element.closest<HTMLElement>('fieldset');
  },
  isPromptSubmitted: isSubmitEvent,
};

import { createEditorHandle, isEligibleEditor, isSubmitEvent } from './dom-editor';
import type { EditorHandle, SiteAdapter } from './editor-adapter';

const SELECTORS = [
  'form #prompt-textarea',
  'form[data-testid="prompt-form"] textarea[aria-label="Message ChatGPT"]',
  'main form textarea[aria-label="Message ChatGPT"]',
];

export const chatgptAdapter: SiteAdapter = {
  id: 'chatgpt',
  findEditor(document) {
    for (const selector of SELECTORS) {
      for (const candidate of document.querySelectorAll(selector)) {
        if (isEligibleEditor(candidate)) return createEditorHandle(candidate);
      }
    }
    return null;
  },
  findControlAnchor(editor: EditorHandle) {
    return editor.element.closest('form');
  },
  isPromptSubmitted: isSubmitEvent,
};

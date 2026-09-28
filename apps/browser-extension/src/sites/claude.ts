import { createEditorHandle, isEligibleEditor, isSubmitEvent } from './dom-editor';
import type { EditorHandle, SiteAdapter } from './editor-adapter';

const SELECTORS = [
  '[data-testid="chat-input"] .ProseMirror[contenteditable="true"]',
  'main form fieldset .ProseMirror[contenteditable="true"]',
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
    return editor.element.closest('[data-testid="chat-input"], fieldset');
  },
  isPromptSubmitted: isSubmitEvent,
};

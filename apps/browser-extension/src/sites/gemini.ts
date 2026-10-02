import { createNativeEditorHandle, isEligibleEditor } from './dom-editor';
import { editorEnter, enabledSendClick } from './composer-events';
import type { EditorHandle, SiteAdapter } from './editor-adapter';

const EDITOR = 'rich-textarea .ql-editor[contenteditable="true"][role="textbox"]';
const COMPOSER = 'input-area-v2, input-area';
const SEND = '[data-test-id="send-button-container"] button, .send-button button, button.send-button';

function composer(editor?: EditorHandle): HTMLElement | null {
  return editor?.element.closest<HTMLElement>(COMPOSER) ?? null;
}

export const geminiAdapter: SiteAdapter = {
  id: 'gemini', requiresFocus: true, protectContent: true,
  findEditor(document, focusedTarget = document.activeElement) {
    const candidate = focusedTarget?.closest(EDITOR);
    if (!candidate || !candidate.closest(COMPOSER) || !isEligibleEditor(candidate) || !candidate.isConnected) return null;
    return createNativeEditorHandle(candidate, 'quill');
  },
  findControlAnchor(editor) {
    const owner = composer(editor);
    // The outer input-container stays at the page bottom while its actual input
    // area can be absolutely positioned in the center of Gemini's welcome page.
    return owner?.closest<HTMLElement>('fieldset.input-area-fieldset') ??
      editor.element.closest<HTMLElement>('.input-area') ?? owner;
  },
  isPromptSubmitted(event, editor) {
    return enabledSendClick(event, composer(editor), SEND) || editorEnter(event, editor, false);
  },
};

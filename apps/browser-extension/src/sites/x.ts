import { createNativeEditorHandle, isEligibleEditor } from './dom-editor';
import { editorEnter, enabledSendClick } from './composer-events';
import type { EditorHandle, SiteAdapter } from './editor-adapter';

const EDITOR = '[data-testid^="tweetTextarea_"][role="textbox"][contenteditable="true"]';
const SEND = '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]';

function composer(editor?: EditorHandle): HTMLElement | null {
  for (let parent = editor?.element.parentElement; parent; parent = parent.parentElement) {
    if (parent.querySelector(SEND)) return parent;
    if (parent.matches('[role="dialog"], main, body')) break;
  }
  return null;
}

export const xAdapter: SiteAdapter = {
  id: 'x', requiresFocus: true, protectContent: true,
  findEditor(document, focusedTarget = document.activeElement) {
    if (/^\/(?:messages|grok|i\/(?:chat|grok))(?:\/|$)/.test(document.defaultView?.location.pathname ?? '')) return null;
    const candidate = focusedTarget?.closest(EDITOR);
    if (!candidate || !isEligibleEditor(candidate) || !candidate.isConnected) return null;
    const editor = createNativeEditorHandle(candidate, 'paste');
    return composer(editor) ? editor : null;
  },
  findControlAnchor: composer,
  isPromptSubmitted(event, editor) {
    const owner = composer(editor);
    return enabledSendClick(event, owner, SEND) || (!!owner && editorEnter(event, editor, true));
  },
};

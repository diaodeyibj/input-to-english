import type { EditorHandle } from './editor-adapter';

export function enabledSendClick(event: Event, composer: HTMLElement | null, selector: string): boolean {
  if (event.type !== 'click' || !(event.target instanceof Element) || !composer) return false;
  const button = event.target.closest<HTMLElement>(selector);
  return !!button && composer.contains(button) && !button.hasAttribute('disabled') &&
    button.getAttribute('aria-disabled') !== 'true' &&
    !button.closest('[data-input-to-english-root]');
}

export function editorEnter(event: Event, editor: EditorHandle | undefined, modifier: boolean): boolean {
  if (!editor || event.type !== 'keydown' || !(event instanceof KeyboardEvent) ||
      !(event.target instanceof Node) || !editor.element.contains(event.target)) return false;
  return event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 &&
    !event.shiftKey && !event.altKey && (modifier ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey);
}

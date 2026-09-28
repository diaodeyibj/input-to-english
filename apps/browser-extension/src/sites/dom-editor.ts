import type { EditorHandle } from './editor-adapter';

const handles = new WeakMap<HTMLElement, EditorHandle>();
const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'BLOCKQUOTE', 'PRE']);

function readChildren(parent: Node): string {
  if (parent instanceof Element && parent.tagName === 'P'
    && parent.childNodes.length === 1 && parent.firstChild instanceof HTMLBRElement) return '';
  let result = '';
  let previousWasBlock = false;
  let sawChild = false;
  for (const child of parent.childNodes) {
    const isBlock = child instanceof Element && BLOCK_TAGS.has(child.tagName);
    if (isBlock && sawChild) result += '\n';
    if (!isBlock && previousWasBlock) result += '\n';

    if (child.nodeType === Node.TEXT_NODE) result += child.nodeValue ?? '';
    else if (child instanceof Element && child.tagName === 'BR') result += '\n';
    else result += readChildren(child);

    previousWasBlock = isBlock;
    sawChild = true;
  }
  return result;
}

function readEditable(element: HTMLElement): string {
  return readChildren(element);
}

function replacementNodes(element: HTMLElement, text: string): Node[] {
  const document = element.ownerDocument;
  if (!element.classList.contains('ProseMirror')) return [document.createTextNode(text)];
  return text.split('\n').map((line) => {
    const paragraph = document.createElement('p');
    paragraph.append(line === '' ? document.createElement('br') : document.createTextNode(line));
    return paragraph;
  });
}

function dispatchInput(element: HTMLElement, type: 'beforeinput' | 'input', text: string): boolean {
  const view = element.ownerDocument.defaultView;
  const event = view?.InputEvent
    ? new view.InputEvent(type, {
      bubbles: true,
      cancelable: type === 'beforeinput',
      inputType: 'insertReplacementText',
      data: text,
    })
    : new Event(type, { bubbles: true, cancelable: type === 'beforeinput' });
  return element.dispatchEvent(event);
}

export function createEditorHandle(element: HTMLElement): EditorHandle {
  const existing = handles.get(element);
  if (existing) return existing;

  let revision = 0;
  element.addEventListener('input', () => { revision += 1; });
  const handle: EditorHandle = {
    element,
    readText: () => element instanceof HTMLTextAreaElement ? element.value : readEditable(element),
    replaceText(text) {
      if (!dispatchInput(element, 'beforeinput', text)) return;
      if (element instanceof HTMLTextAreaElement) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) setter.call(element, text);
        else element.value = text;
      } else {
        element.replaceChildren(...replacementNodes(element, text));
      }
      dispatchInput(element, 'input', text);
    },
    getRevision: () => revision,
    focus: () => element.focus(),
  };
  handles.set(element, handle);
  return handle;
}

export function isEligibleEditor(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLTextAreaElement) {
    if (element.disabled || element.readOnly) return false;
  } else if (element.getAttribute('contenteditable') !== 'true') {
    return false;
  }
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current.hasAttribute('hidden') || current.hasAttribute('inert')
      || current.getAttribute('aria-hidden') === 'true') return false;
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (style?.display === 'none' || style?.visibility === 'hidden') return false;
  }
  return true;
}

export function isSubmitEvent(event: Event): boolean {
  if (event.type === 'submit') return true;
  if (event.type !== 'keydown' || !(event instanceof KeyboardEvent)) return false;
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing;
}

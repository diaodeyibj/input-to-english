import type { EditorHandle } from './editor-adapter';

const handles = new WeakMap<HTMLElement, EditorHandle>();
const nativeHandles = new WeakMap<HTMLElement, Map<string, EditorHandle>>();
const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'BLOCKQUOTE', 'PRE']);

function readChildren(parent: Node): string {
  if (parent instanceof Element && (parent.tagName === 'P' || parent.tagName === 'DIV')
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
      if (!dispatchInput(element, 'beforeinput', text)) {
        throw new Error('Editor replacement was canceled by the host editor.');
      }
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

/** The original remains available if a host fails after partially changing its state. */
export class EditorWriteError extends Error {
  constructor(readonly original: string) {
    super('The host editor could not accept the replacement.');
  }
}

/** Let framework paste handlers update their own model and preserve editable blocks. */
export function createNativeEditorHandle(element: HTMLElement, mode: 'insertText' | 'paste' | 'quill' = 'insertText'): EditorHandle {
  const cached = nativeHandles.get(element)?.get(mode);
  if (cached) return cached;
  const base = createEditorHandle(element);
  const document = element.ownerDocument;
  const readText = (): string => {
    const blocks = element.querySelectorAll(':scope > [data-contents="true"] > [data-block="true"]');
    if (!blocks.length) return base.readText();
    return Array.from(blocks, block => block.textContent === '' && block.querySelector('br[data-text]')
      ? '' : readChildren(block)).join('\n');
  };
  const safe = () => element.isConnected && isEligibleEditor(element) &&
    !element.querySelector('[contenteditable="false"], img, video, audio, iframe, input, textarea');
  const select = () => {
    const selection = document.getSelection();
    if (!selection) throw new Error('Editor selection is unavailable.');
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    // Draft derives its model selection from the browser selection event.
    document.dispatchEvent(new Event('selectionchange'));
  };
  const nextTask = () => new Promise<void>(resolve => setTimeout(resolve, 0));
  const handle: EditorHandle = {
    ...base,
    readText,
    replaceText(text, canWrite = () => true) {
      if (!safe() || !canWrite()) throw new Error('This rich editor cannot safely replace its content.');
      if (mode === 'paste' ? typeof DataTransfer !== 'function' || typeof ClipboardEvent !== 'function'
          : typeof document.execCommand !== 'function') {
        throw new Error('The host editing pipeline is unavailable.');
      }
      const original = readText();
      const priorSelection = document.getSelection();
      const priorRange = priorSelection?.rangeCount === 1 &&
        element.contains(priorSelection.getRangeAt(0).commonAncestorContainer)
        ? priorSelection.getRangeAt(0).cloneRange() : undefined;
      const revision = base.getRevision();
      const current = () => safe() && canWrite() && document.activeElement === element;
      const unchanged = () => current() && readText() === original && base.getRevision() === revision;
      element.focus({ preventScroll: true });
      // Focusing can synchronously rebuild the editor or change the active action.
      if (!unchanged()) throw new Error('The editor changed while focusing.');
      select();
      const selectionUnchanged = () => {
        const selection = document.getSelection();
        if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return false;
        const range = selection.getRangeAt(0);
        if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return false;
        // Draft may normalize editor-level boundaries into nested text leaves.
        const full = document.createRange(); full.selectNodeContents(element);
        return range.toString() === full.toString();
      };
      const restoreCaret = () => {
        if (!unchanged() || !selectionUnchanged()) return; // Preserve newer user selections.
        const selection = document.getSelection()!;
        if (priorRange && priorRange.startContainer.isConnected && priorRange.endContainer.isConnected) {
          selection.removeAllRanges(); selection.addRange(priorRange);
        } else {
          selection.collapse(element, element.childNodes.length);
        }
        document.dispatchEvent(new Event('selectionchange'));
      };
      if (!unchanged() || !selectionUnchanged()) {
        restoreCaret();
        throw new Error('The editor changed while selecting.');
      }
      if (mode === 'paste') {
        return (async () => {
          // Allow framework selection state to settle before its paste handler runs.
          await nextTask();
          if (!unchanged() || !selectionUnchanged()) throw new Error('The editor changed before replacement.');
          if (typeof DataTransfer !== 'function' || typeof ClipboardEvent !== 'function') {
            throw new Error('The host paste pipeline is unavailable.');
          }
          const data = new DataTransfer();
          data.setData('text/plain', text);
          const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data });
          element.dispatchEvent(event);
          const writtenRevision = base.getRevision();
          // A framework render can be deferred beyond the next timer task.
          const deadline = Date.now() + 500;
          do {
            await nextTask();
            if (!current() || base.getRevision() !== writtenRevision) break;
            if (event.defaultPrevented && readText() === text) return;
            if (!event.defaultPrevented) break;
            await new Promise<void>(resolve => setTimeout(resolve, 16));
          } while (Date.now() < deadline);
          restoreCaret();
          // Never overwrite a user's subsequent edits with an attempted rollback.
          throw new EditorWriteError(original);
        })().catch(cause => { restoreCaret(); throw cause; });
      }
      if (typeof document.execCommand !== 'function') throw new Error('Native editing is unavailable.');
      let accepted = false;
      try { accepted = document.execCommand('insertText', false, text); } catch { /* report safely below */ }
      if (mode === 'quill') {
        const writtenRevision = base.getRevision();
        return (async () => {
          // Quill's MutationObserver must normalize the native edit into its model.
          await nextTask();
          if (accepted && current() && readText() === text && base.getRevision() === writtenRevision) return;
          throw new EditorWriteError(original);
        })();
      }
      if (accepted && current() && readText() === text) return;
      throw new EditorWriteError(original);
    },
  };
  let modes = nativeHandles.get(element);
  if (!modes) { modes = new Map(); nativeHandles.set(element, modes); }
  modes.set(mode, handle);
  return handle;
}

export function isSubmitEvent(event: Event, editor?: EditorHandle): boolean {
  if (editor) {
    const belongs = event.type === 'submit'
      ? event.target === editor.element.closest('form')
      : event.target instanceof Node && editor.element.contains(event.target);
    if (!belongs) return false;
  }
  if (event.type === 'submit') return true;
  if (event.type !== 'keydown' || !(event instanceof KeyboardEvent)) return false;
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing;
}

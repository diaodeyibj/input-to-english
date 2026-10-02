import type { ControllerState } from '../content/translation-controller';
import translateControlCss from './translate-control.css';

type ActionHandler = () => void;

export interface TranslationControllerBinding {
  state: ControllerState;
  subscribe(listener: (state: ControllerState) => void): () => void;
  translate(): Promise<void> | void;
  undo(): boolean | void | Promise<boolean>;
}

export interface TranslateControl {
  element: HTMLDivElement;
  render(state: ControllerState): void;
  onTranslate(handler: ActionHandler): () => void;
  onUndo(handler: ActionHandler): () => void;
  bind(controller: TranslationControllerBinding): () => void;
  dispose(): void;
}

const INITIAL_STATE: ControllerState = { status: 'idle', canUndo: false };

function labelFor(state: ControllerState): string {
  if (state.status === 'translating') return 'Translating…';
  if (state.status === 'downloading') {
    const progress = state.progress;
    const percentage = progress && progress.total > 0
      ? Math.max(0, Math.min(100, Math.round((progress.loaded / progress.total) * 100)))
      : undefined;
    return percentage === undefined ? 'Downloading…' : `Downloading ${percentage}%`;
  }
  return '-> EN';
}

/**
 * A self-contained presentation control. It deliberately owns no provider,
 * settings, or host-page mounting concerns; Task 12 wires it to a controller.
 */
export function createTranslateControl(): TranslateControl {
  const element = document.createElement('div');
  element.setAttribute('data-input-to-english-control', '');
  const shadow = element.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = translateControlCss;
  const container = document.createElement('div');
  container.className = 'control';
  const translateButton = document.createElement('button');
  translateButton.type = 'button';
  translateButton.setAttribute('aria-label', 'Translate prompt to English');
  const undoButton = document.createElement('button');
  undoButton.type = 'button';
  undoButton.textContent = 'Undo';
  undoButton.setAttribute('aria-label', 'Restore original prompt');
  const alert = document.createElement('span');
  alert.setAttribute('role', 'alert');
  alert.setAttribute('aria-live', 'polite');
  const recovery = document.createElement('textarea');
  recovery.readOnly = true;
  recovery.setAttribute('aria-label', 'Original text for recovery');
  recovery.style.width = '100%';
  recovery.hidden = true;
  container.append(translateButton, undoButton, alert, recovery);
  shadow.append(style, container);

  const translateHandlers = new Set<ActionHandler>();
  const undoHandlers = new Set<ActionHandler>();
  let unsubscribe: (() => void) | undefined;
  let disposed = false;

  const invoke = (handlers: Set<ActionHandler>): void => {
    if (disposed) return;
    for (const handler of handlers) handler();
  };
  const onTranslateClick = (event: Event): void => { event.stopPropagation(); invoke(translateHandlers); };
  const onUndoClick = (event: Event): void => { event.stopPropagation(); invoke(undoHandlers); };
  const onPointerDown = (event: Event): void => { event.stopPropagation(); };
  const onMouseDown = (event: MouseEvent): void => {
    event.stopPropagation();
    if (event.button === 0) event.preventDefault(); // Keep the editor caret during a mouse action.
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const target = event.currentTarget;
    if (target instanceof HTMLButtonElement && !target.disabled) {
      invoke(target === translateButton ? translateHandlers : undoHandlers);
    }
  };
  translateButton.addEventListener('click', onTranslateClick);
  translateButton.addEventListener('keydown', onKeyDown);
  undoButton.addEventListener('click', onUndoClick);
  undoButton.addEventListener('keydown', onKeyDown);
  for (const button of [translateButton, undoButton]) {
    button.addEventListener('pointerdown', onPointerDown);
    button.addEventListener('mousedown', onMouseDown);
  }

  const render = (state: ControllerState): void => {
    if (disposed) return;
    const busy = state.status === 'translating' || state.status === 'downloading';
    translateButton.textContent = labelFor(state);
    translateButton.disabled = busy;
    translateButton.setAttribute('aria-busy', String(busy));
    undoButton.hidden = !state.canUndo;
    undoButton.disabled = !state.canUndo || busy;
    recovery.hidden = state.recoveryText === undefined;
    recovery.value = state.recoveryText ?? '';
    alert.textContent = state.status === 'error' ? (state.error?.userMessage ?? 'Translation failed. Please try again.') + (state.recoveryText === undefined ? '' : ' Original text is available below.') : '';
  };

  const addHandler = (handlers: Set<ActionHandler>, handler: ActionHandler): (() => void) => {
    if (disposed) return () => {};
    handlers.add(handler);
    return () => handlers.delete(handler);
  };

  render(INITIAL_STATE);
  return {
    element,
    render,
    onTranslate: (handler) => addHandler(translateHandlers, handler),
    onUndo: (handler) => addHandler(undoHandlers, handler),
    bind(controller) {
      if (disposed) return () => {};
      unsubscribe?.();
      const removeTranslate = addHandler(translateHandlers, () => { void controller.translate(); });
      const removeUndo = addHandler(undoHandlers, () => { controller.undo(); });
      const stopState = controller.subscribe(render);
      const cleanup = (): void => {
        removeTranslate();
        removeUndo();
        stopState();
        if (unsubscribe === cleanup) unsubscribe = undefined;
      };
      unsubscribe = cleanup;
      render(controller.state);
      return cleanup;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe?.();
      translateHandlers.clear();
      undoHandlers.clear();
      translateButton.removeEventListener('click', onTranslateClick);
      translateButton.removeEventListener('keydown', onKeyDown);
      undoButton.removeEventListener('click', onUndoClick);
      undoButton.removeEventListener('keydown', onKeyDown);
      for (const button of [translateButton, undoButton]) {
        button.removeEventListener('pointerdown', onPointerDown);
        button.removeEventListener('mousedown', onMouseDown);
      }
      element.remove();
    },
  };
}

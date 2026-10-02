// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ControllerState } from '../../src/content/translation-controller';
import { createTranslateControl } from '../../src/ui/translate-control';

function getButton(control: ReturnType<typeof createTranslateControl>, label: string): HTMLButtonElement {
  const button = [...control.element.shadowRoot!.querySelectorAll('button')]
    .find((candidate) => candidate.textContent === label);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing ${label} button`);
  return button;
}

afterEach(() => document.body.replaceChildren());

describe('translate control', () => {
  it('encapsulates its compact trigger in a Shadow Root', () => {
    const control = createTranslateControl();
    document.body.append(control.element);

    expect(control.element.shadowRoot).not.toBeNull();
    expect(control.element.shadowRoot!.querySelector('button')?.textContent).toBe('-> EN');
    expect(document.body.querySelector('button')).toBeNull();
  });

  it('keeps mouse activation out of host composer focus handlers and preserves the editor caret', () => {
    const owner = document.createElement('section');
    const editor = document.createElement('div'); editor.contentEditable = 'true'; editor.tabIndex = 0; editor.textContent = 'draft';
    const control = createTranslateControl(); owner.append(editor, control.element); document.body.append(owner);
    editor.focus(); document.getSelection()!.collapse(editor.firstChild, 2);
    const host = vi.fn(() => editor.focus());
    owner.addEventListener('mousedown', host); owner.addEventListener('click', host);
    const translate = vi.fn(); control.onTranslate(translate);
    const button = getButton(control, '-> EN');
    const down = new MouseEvent('mousedown', { bubbles: true, composed: true, cancelable: true, button: 0 });
    button.dispatchEvent(down); button.click();
    expect(down.defaultPrevented).toBe(true);
    expect(host).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(editor);
    expect(document.getSelection()!.anchorOffset).toBe(2);
    expect(translate).toHaveBeenCalledOnce();
    control.dispose();
  });

  it('offers a read-only original when a host fails after changing its draft', () => {
    const control = createTranslateControl();
    control.render({ status: 'error', canUndo: false, recoveryText: '原文 <script>安全</script>' });
    const original = control.element.shadowRoot!.querySelector('textarea')!;
    expect(original.readOnly).toBe(true);
    expect(original.hidden).toBe(false);
    expect(original.value).toBe('原文 <script>安全</script>');
    expect(control.element.shadowRoot!.querySelector('script')).toBeNull();
    control.render({ status: 'idle', canUndo: false });
    expect(original.hidden).toBe(true);
    expect(original.value).toBe('');
  });

  it('invokes the translate callback from mouse and keyboard activation', () => {
    const control = createTranslateControl();
    const translate = vi.fn();
    control.onTranslate(translate);
    const button = getButton(control, '-> EN');

    button.click();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(translate).toHaveBeenCalledTimes(3);
  });

  it('disables translation while translating and reports model download progress', () => {
    const control = createTranslateControl();
    control.render({ status: 'translating', canUndo: false });
    expect(getButton(control, 'Translating…').disabled).toBe(true);

    const downloading: ControllerState = {
      status: 'downloading',
      canUndo: false,
      progress: { kind: 'model-download', loaded: 1, total: 4 },
    };
    control.render(downloading);
    expect(getButton(control, 'Downloading 25%').disabled).toBe(true);
  });

  it('renders Undo after success and invokes only its undo callback', () => {
    const control = createTranslateControl();
    const translate = vi.fn();
    const undo = vi.fn();
    control.onTranslate(translate);
    control.onUndo(undo);
    control.render({ status: 'success', canUndo: true });

    getButton(control, 'Undo').click();

    expect(undo).toHaveBeenCalledOnce();
    expect(translate).not.toHaveBeenCalled();
  });

  it('binds controller actions and state updates, then unsubscribes cleanly', () => {
    const control = createTranslateControl();
    const translate = vi.fn();
    const undo = vi.fn();
    let listener: ((state: ControllerState) => void) | undefined;
    const unsubscribe = vi.fn(() => { listener = undefined; });
    const controller = {
      state: { status: 'idle', canUndo: false } as ControllerState,
      subscribe: vi.fn((next: (state: ControllerState) => void) => {
        listener = next;
        return unsubscribe;
      }),
      translate,
      undo,
    };

    const stop = control.bind(controller);
    listener?.({ status: 'success', canUndo: true });
    getButton(control, 'Undo').click();
    stop();
    getButton(control, '-> EN').click();

    expect(undo).toHaveBeenCalledOnce();
    expect(translate).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('presents a controller error as actionable text rather than markup', () => {
    const control = createTranslateControl();
    control.render({
      status: 'error',
      canUndo: false,
      error: { name: 'TranslationError', code: 'EMPTY_INPUT', userMessage: '<strong>Enter text first.</strong>', retryable: false },
    } as ControllerState);

    const alert = control.element.shadowRoot!.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe('<strong>Enter text first.</strong>');
    expect(alert?.querySelector('strong')).toBeNull();
    expect(getButton(control, '-> EN').disabled).toBe(false);
  });

  it('removes event listeners and its host on dispose', () => {
    const control = createTranslateControl();
    const translate = vi.fn();
    control.onTranslate(translate);
    document.body.append(control.element);
    const button = getButton(control, '-> EN');

    control.dispose();
    button.click();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(translate).not.toHaveBeenCalled();
    expect(control.element.isConnected).toBe(false);
  });
});

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

import { beforeEach, describe, expect, it, vi } from 'vitest';

import background from '../../entrypoints/background';
import { handleRuntimeMessage } from '../../src/messaging/background-handler';
import type { RuntimeResponse } from '../../src/messaging/protocol';

vi.mock('../../src/messaging/background-handler', () => ({
  handleRuntimeMessage: vi.fn(),
}));

type Listener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | undefined;

describe('background entrypoint', () => {
  let listener: Listener;
  let finishLock: () => void;
  let failLock: (reason: unknown) => void;
  let accessOptions: unknown;
  let storageThen: ReturnType<typeof vi.spyOn>;
  let actionListener: (() => void) | undefined;
  let openOptionsPage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    const storageReady = new Promise<void>((resolve, reject) => {
      finishLock = resolve;
      failLock = reject;
    });
    storageThen = vi.spyOn(storageReady, 'then');
    storageThen.mockClear();
    const setAccessLevel = (options: unknown) => {
      accessOptions = options;
      return storageReady;
    };
    const addListener = vi.fn((callback: Listener) => { listener = callback; });
    openOptionsPage = vi.fn(async () => undefined);
    vi.stubGlobal('browser', {
      storage: { local: { setAccessLevel } },
      runtime: { onMessage: { addListener } },
    });
    vi.stubGlobal('chrome', {
      action: { onClicked: { addListener: vi.fn((callback: () => void) => { actionListener = callback; }) } },
      runtime: { openOptionsPage },
    });
    background.main();
    expect(addListener).toHaveBeenCalledTimes(1);
  });

  it('restricts local storage before handling a message and keeps the async response channel open', async () => {
    const response: RuntimeResponse = { ok: true, type: 'get-active-provider', activeProvider: 'browser' };
    vi.mocked(handleRuntimeMessage).mockResolvedValueOnce(response);
    const sendResponse = vi.fn();
    expect(accessOptions).toEqual({ accessLevel: 'TRUSTED_CONTEXTS' });
    expect(listener({ type: 'get-active-provider' }, {}, sendResponse)).toBe(true);
    expect(handleRuntimeMessage).not.toHaveBeenCalled();
    finishLock();
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(response));
    expect(handleRuntimeMessage).toHaveBeenCalledWith({ type: 'get-active-provider' });
    expect(sendResponse).toHaveBeenCalledTimes(1);
  });

  it('opens the full settings page when the toolbar icon is clicked', async () => {
    actionListener?.();

    await vi.waitFor(() => expect(openOptionsPage).toHaveBeenCalledOnce());
  });

  it('uses Edge legacy browserAction when the MV3 action API is unavailable', async () => {
    const legacyOpenOptionsPage = vi.fn(async () => undefined);
    let legacyListener: (() => void) | undefined;
    vi.stubGlobal('chrome', {
      browserAction: {
        onClicked: { addListener: vi.fn((callback: () => void) => { legacyListener = callback; }) },
      },
      runtime: { openOptionsPage: legacyOpenOptionsPage },
    });

    background.main();
    legacyListener?.();

    await vi.waitFor(() => expect(legacyOpenOptionsPage).toHaveBeenCalledOnce());
  });

  it('keeps handling closed and returns a safe error if storage restriction fails before a message', async () => {
    expect(storageThen).toHaveBeenCalledTimes(1);
    failLock(new Error('secret initialization failure'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const sendResponse = vi.fn();
    expect(listener({ type: 'translate', providerId: 'deepseek', text: '你好' }, {}, sendResponse))
      .toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1));
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'UNKNOWN', userMessage: 'An unexpected error occurred.', retryable: false },
    });
    expect(handleRuntimeMessage).not.toHaveBeenCalled();
    expect(JSON.stringify(sendResponse.mock.calls)).not.toContain('secret initialization failure');
  });
});

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
    vi.stubGlobal('browser', {
      storage: { local: { setAccessLevel } },
      runtime: { onMessage: { addListener } },
    });
    background.main();
    expect(addListener).toHaveBeenCalledTimes(1);
  });

  it('restricts local storage before handling a message and keeps the async response channel open', async () => {
    const response: RuntimeResponse = { ok: true, type: 'list-ollama-models', models: [] };
    vi.mocked(handleRuntimeMessage).mockResolvedValueOnce(response);
    const sendResponse = vi.fn();
    expect(accessOptions).toEqual({ accessLevel: 'TRUSTED_CONTEXTS' });
    expect(listener({ type: 'list-ollama-models' }, {}, sendResponse)).toBe(true);
    expect(handleRuntimeMessage).not.toHaveBeenCalled();
    finishLock();
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(response));
    expect(handleRuntimeMessage).toHaveBeenCalledWith({ type: 'list-ollama-models' });
    expect(sendResponse).toHaveBeenCalledTimes(1);
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

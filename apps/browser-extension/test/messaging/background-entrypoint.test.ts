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
  let setAccessLevel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setAccessLevel = vi.fn(() => new Promise<void>((resolve) => { finishLock = resolve; }));
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
    expect(setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
    expect(listener({ type: 'list-ollama-models' }, {}, sendResponse)).toBe(true);
    expect(handleRuntimeMessage).not.toHaveBeenCalled();
    finishLock();
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(response));
    expect(handleRuntimeMessage).toHaveBeenCalledWith({ type: 'list-ollama-models' });
    expect(sendResponse).toHaveBeenCalledTimes(1);
  });
});

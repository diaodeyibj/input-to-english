// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import content from '../../entrypoints/content';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('content entrypoint', () => {
  it('registers only the approved ChatGPT and Claude origins', () => {
    expect(content.matches).toEqual(['https://chatgpt.com/*', 'https://claude.ai/*']);
  });

  it('mounts the control, uses only background messages, and cleans up on invalidation', async () => {
    vi.stubGlobal('location', { hostname: 'chatgpt.com' });
    const sendMessage = vi.fn(async (message: { type: string }) => {
      if (message.type === 'get-active-provider') {
        return { ok: true, type: 'get-active-provider', activeProvider: 'deepseek' };
      }
      return { ok: true, type: 'translate', result: { text: 'Hello', providerId: 'deepseek' } };
    });
    vi.stubGlobal('browser', { runtime: { sendMessage } });
    document.body.innerHTML = '<main><form data-testid="prompt-form"><textarea aria-label="Message ChatGPT">你好</textarea></form></main>';
    let invalidate: (() => void) | undefined;
    content.main({ onInvalidated(callback: () => void) { invalidate = callback; } } as never);
    const root = document.querySelector<HTMLElement>('[data-input-to-english-root="v1"]')!;
    expect(root).not.toBeNull();

    root.shadowRoot!.querySelector<HTMLButtonElement>('button[aria-label="Translate prompt to English"]')!.click();
    await vi.waitFor(() => expect(document.querySelector('textarea')?.value).toBe('Hello'));
    expect(sendMessage.mock.calls.map(([message]) => message.type)).toEqual([
      'get-active-provider', 'translate',
    ]);
    invalidate?.();
    expect(root.isConnected).toBe(false);
  });

  it('does not mount on another hostname even if its DOM looks like ChatGPT', () => {
    vi.stubGlobal('location', { hostname: 'chatgpt.com.evil.test' });
    vi.stubGlobal('browser', { runtime: { sendMessage: vi.fn() } });
    document.body.innerHTML = '<main><form data-testid="prompt-form"><textarea aria-label="Message ChatGPT"></textarea></form></main>';
    content.main({ onInvalidated: vi.fn() } as never);
    expect(document.querySelector('[data-input-to-english-root="v1"]')).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { withTimeout } from '../src/async';

describe('withTimeout', () => {
  afterEach(() => vi.useRealTimers());

  it('returns a result completed before the deadline and clears its timer', async () => {
    vi.useFakeTimers();
    const result = await withTimeout(async (signal) => {
      expect(signal.aborted).toBe(false);
      return 'ready';
    }, 30_000);
    expect(result).toBe('ready');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts and rejects at exactly 30 seconds', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const pending = withTimeout(async (operationSignal) => {
      signal = operationSignal;
      return new Promise<string>(() => undefined);
    }, 30_000);
    const rejection = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores an operation result that arrives after timeout', async () => {
    vi.useFakeTimers();
    let complete!: (value: string) => void;
    const pending = withTimeout(
      () => new Promise<string>((resolve) => { complete = resolve; }),
      30_000,
    );
    const rejection = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(30_000);
    await rejection;
    complete('too late');
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects TIMEOUT when an abort listener synchronously resolves the operation', async () => {
    vi.useFakeTimers();
    const pending = withTimeout((signal) => new Promise<string>((resolve) => {
      signal.addEventListener('abort', () => resolve('abort-handler result'));
    }), 30_000);
    const rejection = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(30_000);
    await rejection;
  });
});

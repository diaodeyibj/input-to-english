import { describe, expect, it, vi } from 'vitest';

import { createJsonHttpClient } from '../src/http';

describe('createJsonHttpClient', () => {
  it('serializes a JSON request and parses a JSON response', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(JSON.stringify({ translated: 'Hello' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createJsonHttpClient(fetch);

    await expect(
      client.request<{ translated: string }>({
        url: 'https://api.example.test/chat',
        method: 'POST',
        headers: { Authorization: 'Bearer secret' },
        body: { text: '你好' },
      }),
    ).resolves.toEqual({ status: 200, data: { translated: 'Hello' } });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.example.test/chat');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: '你好' }),
    });
  });

  it('passes the abort signal to fetch', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createJsonHttpClient(fetch);
    const controller = new AbortController();

    await client.request({
      url: 'https://api.example.test/chat',
      signal: controller.signal,
    });

    expect(fetch.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it('returns only the status for a non-JSON response body', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response('<html>secret upstream diagnostics</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      }),
    );
    const client = createJsonHttpClient(fetch);

    await expect(
      client.request({ url: 'https://api.example.test/chat' }),
    ).resolves.toEqual({ status: 502 });
  });
});

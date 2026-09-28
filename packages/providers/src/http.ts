export interface JsonHttpRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface JsonHttpResponse<T> {
  status: number;
  data?: T;
}

export interface JsonHttpClient {
  request<T>(request: JsonHttpRequest): Promise<JsonHttpResponse<T>>;
}

export function createJsonHttpClient(
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): JsonHttpClient {
  return {
    async request<T>({ url, method, headers, body, signal }: JsonHttpRequest) {
      const response = await fetchImplementation(url, {
        method,
        headers:
          body === undefined
            ? headers
            : { ...headers, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });

      if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
        return { status: response.status };
      }

      try {
        return { status: response.status, data: (await response.json()) as T };
      } catch {
        return { status: response.status };
      }
    },
  };
}

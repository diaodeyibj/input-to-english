export const translationErrorCodes = [
  'EMPTY_INPUT',
  'ALREADY_ENGLISH',
  'INPUT_CHANGED',
  'PROVIDER_NOT_CONFIGURED',
  'AUTHENTICATION_FAILED',
  'RATE_LIMITED',
  'TIMEOUT',
  'NETWORK_ERROR',
  'MALFORMED_RESPONSE',
  'BROWSER_API_UNAVAILABLE',
  'UNSUPPORTED_LANGUAGE',
  'MODEL_DOWNLOAD_FAILED',
  'OLLAMA_UNAVAILABLE',
  'MODEL_NOT_FOUND',
  'EDITOR_NOT_FOUND',
  'UNKNOWN',
] as const;

export type TranslationErrorCode = (typeof translationErrorCodes)[number];

export interface TranslationErrorInit {
  code: TranslationErrorCode;
  userMessage: string;
  retryable: boolean;
  cause?: unknown;
}

export class TranslationError extends Error {
  readonly code: TranslationErrorCode;
  readonly userMessage: string;
  readonly retryable: boolean;

  constructor({ code, userMessage, retryable, cause }: TranslationErrorInit) {
    super(userMessage, cause === undefined ? undefined : { cause });
    this.name = 'TranslationError';
    this.code = code;
    this.userMessage = userMessage;
    this.retryable = retryable;
  }
}

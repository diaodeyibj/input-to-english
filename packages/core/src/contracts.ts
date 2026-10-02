import type { TranslationError } from './errors';

export type ProviderId = 'browser' | 'deepseek' | 'kimi';

export interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: 'en';
}

export interface TranslationResult {
  text: string;
  providerId: ProviderId;
  sourceLanguage?: string;
}

export interface TranslationProgress {
  kind: 'model-download';
  loaded: number;
  total: number;
}

export interface ProviderAvailability {
  status: 'available' | 'unavailable' | 'downloadable' | 'downloading';
  detail?: string;
}

export type ConnectionTestResult =
  | { ok: true; detail: string }
  | { ok: false; error: TranslationError };

export interface TranslationOptions {
  signal?: AbortSignal;
  onProgress?: (progress: TranslationProgress) => void;
}

export interface TranslationProvider {
  id: ProviderId;
  availability(): Promise<ProviderAvailability>;
  testConnection?(): Promise<ConnectionTestResult>;
  translate(
    request: TranslationRequest,
    options?: TranslationOptions,
  ): Promise<TranslationResult>;
}

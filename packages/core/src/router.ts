import type {
  ProviderId,
  TranslationOptions,
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from './contracts';
import { TranslationError } from './errors';

export class TranslationRouter {
  private readonly providers: ReadonlyMap<ProviderId, TranslationProvider>;

  constructor(providers: Iterable<TranslationProvider>) {
    this.providers = new Map(
      Array.from(providers, (provider) => [provider.id, provider]),
    );
  }

  async translate(
    providerId: ProviderId,
    request: TranslationRequest,
    options?: TranslationOptions,
  ): Promise<TranslationResult> {
    const provider = this.providers.get(providerId);

    if (provider === undefined) {
      throw new TranslationError({
        code: 'PROVIDER_NOT_CONFIGURED',
        userMessage: 'The selected translation provider is not configured.',
        retryable: false,
      });
    }

    return provider.translate(request, options);
  }
}

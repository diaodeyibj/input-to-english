import type { LanguageDetectionBridge } from './browser-local';

export function nonLatinText(text: string): string {
  // Ignore numbers, punctuation and emoji; these also occur in English input.
  return (text.replace(/\p{Script=Latin}+/gu, ' ').match(/[\p{L}\p{M}]+/gu) ?? [])
    .filter((word) => /\p{L}/u.test(word)).join(' ');
}

function languageOf(result: { detectedLanguage: string; confidence: number }): string | undefined {
  if (!result || !Number.isFinite(result.confidence) || result.confidence < 0.5 ||
      result.confidence > 1 || typeof result.detectedLanguage !== 'string' ||
      result.detectedLanguage === '' || result.detectedLanguage === 'und') return undefined;
  try { return Intl.getCanonicalLocales(result.detectedLanguage)[0]; } catch { return undefined; }
}

export async function detectSourceLanguage(
  text: string,
  detector: LanguageDetectionBridge,
  options?: { signal?: AbortSignal },
): Promise<string | undefined> {
  const source = languageOf(await detector.detect(text, options));
  if (source?.split('-')[0].toLowerCase() !== 'en') return source;
  const fragment = nonLatinText(text);
  if (!fragment) return source;
  options?.signal?.throwIfAborted();
  // A dominant-English result is not proof that the whole input is English.
  const fragmentSource = languageOf(await detector.detect(fragment, options));
  return fragmentSource?.split('-')[0].toLowerCase() === 'en' ? undefined : fragmentSource;
}

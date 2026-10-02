import { TranslationError } from '../../../../packages/core/src/index';

interface Span { start: number; end: number; value: string }

function spans(text: string): Span[] {
  const result: Span[] = [];
  const tokens = /https?:\/\/[^\s<>"\u3000-\u303f\uff00-\uff65]+|www\.[^\s<>"\u3000-\u303f\uff00-\uff65]+|(?<![A-Za-z0-9_])@[A-Za-z0-9_]+|(?<![\p{L}\p{N}_])#[\p{L}\p{M}\p{N}_]+|\r\n|\r|\n/gu;
  for (const match of text.matchAll(tokens)) {
    result.push({ start: match.index!, end: match.index! + match[0].length, value: match[0] });
  }
  for (const { segment, index } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(segment) &&
        !result.some(span => index >= span.start && index < span.end)) {
      result.push({ start: index, end: index + segment.length, value: segment });
    }
  }
  return result.sort((a, b) => a.start - b.start);
}

function unsafeTranslation(): TranslationError {
  return new TranslationError({ code: 'MALFORMED_RESPONSE', retryable: true,
    userMessage: 'The translation changed protected content. Your original text was kept. Try again.' });
}

/** One request, no provider-specific prompt dependency; restore only an exact round trip. */
export function protectText(original: string): { text: string; restore(text: string): string } {
  let nonce = 0;
  while (original.includes(`[[ITE${nonce}_`)) nonce++;
  const protectedSpans = spans(original);
  const markers = protectedSpans.map((_, i) => `[[ITE${nonce}_${i}]]`);
  let cursor = 0;
  let text = '';
  protectedSpans.forEach((span, i) => {
    text += original.slice(cursor, span.start) + markers[i];
    cursor = span.end;
  });
  text += original.slice(cursor);
  return {
    text,
    restore(translated) {
      const pattern = new RegExp(`\\[\\[ITE${nonce}_\\d+\\]\\]`, 'g');
      const found = translated.match(pattern) ?? [];
      if (found.length !== markers.length || found.some((marker, i) => marker !== markers[i])) throw unsafeTranslation();
      // Newly generated URLs, tags, emoji or line breaks are not user-authored content.
      const withoutMarkers = translated.replace(pattern, '');
      if (withoutMarkers.includes(`[[ITE${nonce}_`) || spans(withoutMarkers).length !== 0) throw unsafeTranslation();
      let i = 0;
      return translated.replace(pattern, () => protectedSpans[i++].value);
    },
  };
}

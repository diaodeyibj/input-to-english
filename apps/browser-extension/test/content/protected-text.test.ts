import { describe, expect, it } from 'vitest';
import { protectText } from '../../src/content/protected-text';

describe('protected user content', () => {
  it('protects usernames adjacent to Chinese text', () => {
    const protectedText = protectText('谢谢@alice');
    expect(() => protectedText.restore('Thanks')).toThrow();
    expect(protectedText.restore(protectedText.text.replace('谢谢', 'Thanks'))).toBe('Thanks@alice');
  });
  it('restores mentions, multilingual tags, URLs, emoji clusters and exact newlines', () => {
    const protectedText = protectText('你好 @alice #中文 https://example.com/a?q=1 👩🏽‍💻 🇨🇳 1️⃣\n\n再见\n');
    expect(protectedText.restore(protectedText.text.replace('你好', 'Hello').replace('再见', 'Goodbye')))
      .toBe('Hello @alice #中文 https://example.com/a?q=1 👩🏽‍💻 🇨🇳 1️⃣\n\nGoodbye\n');
  });

  it('rejects missing, duplicate and reordered markers rather than losing user content', () => {
    const protectedText = protectText('你好 @alice #中文');
    const markers = protectedText.text.match(/\[\[ITE\d+_\d+\]\]/g)!;
    expect(() => protectedText.restore(protectedText.text.replace(markers[0], ''))).toThrow();
    expect(() => protectedText.restore(protectedText.text + markers[0])).toThrow();
    expect(() => protectedText.restore(`Hello ${markers[1]} ${markers[0]}`)).toThrow();
  });

  it('does not collide with literal marker-like text already in the input', () => {
    const protectedText = protectText('你好 [[ITE0_0]] @alice');
    expect(protectedText.restore(protectedText.text.replace('你好', 'Hello'))).toBe('Hello [[ITE0_0]] @alice');
  });

  it('rejects provider-added line breaks and new protected tokens', () => {
    const protectedText = protectText('你好 @alice');
    expect(() => protectedText.restore(protectedText.text + '\n')).toThrow();
    expect(() => protectedText.restore(protectedText.text + ' @other')).toThrow();
  });
});

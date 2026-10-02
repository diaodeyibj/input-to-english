import { describe, expect, it } from 'vitest';

import config from '../../../wxt.config';

describe('extension manifest configuration', () => {
  it('grants only the four input sites and two selected-provider API origins', () => {
    const manifest = config.manifest as { host_permissions?: string[] };
    expect(manifest.host_permissions).toEqual([
      'https://chatgpt.com/*', 'https://claude.ai/*', 'https://gemini.google.com/*', 'https://x.com/*',
      'https://api.deepseek.com/*', 'https://api.moonshot.cn/*',
    ]);
  });
  it('does not request localhost or Ollama host access', () => {
    const manifest = config.manifest as { host_permissions?: string[] } | undefined;
    expect(manifest?.host_permissions ?? []).not.toContain('http://localhost:11434/*');
  });

  it('declares a toolbar action so browsers expose the action click API', () => {
    expect(config.manifest).toEqual(expect.objectContaining({
      name: 'Input to English',
      description: 'Translate your input to English in place on ChatGPT, Claude, Gemini and X.',
      action: expect.objectContaining({
        default_title: 'Open settings',
        default_icon: {
          16: 'icons/icon-16.png',
          32: 'icons/icon-32.png',
          48: 'icons/icon-48.png',
          128: 'icons/icon-128.png',
        },
      }),
      icons: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
      },
    }));
  });
});

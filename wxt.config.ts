import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  srcDir: 'apps/browser-extension',
  publicDir: 'apps/browser-extension/public',
  manifest: {
    name: 'Input to English',
    description: 'Translate your input to English in place on ChatGPT, Claude, Gemini and X.',
    action: {
      default_title: 'Open settings',
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
      },
    },
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    permissions: ['storage'],
    host_permissions: [
      'https://chatgpt.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://x.com/*',
      'https://api.deepseek.com/*',
      'https://api.moonshot.cn/*',
    ],
  },
});

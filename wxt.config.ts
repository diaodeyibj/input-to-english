import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  srcDir: 'apps/browser-extension',
  manifest: {
    permissions: ['storage'],
    host_permissions: [
      'https://chatgpt.com/*',
      'https://claude.ai/*',
      'https://api.deepseek.com/*',
      'https://api.moonshot.cn/*',
      'http://localhost:11434/*',
    ],
  },
});

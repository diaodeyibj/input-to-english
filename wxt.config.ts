import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'apps/browser-extension',
  manifest: {
    manifest_version: 3,
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

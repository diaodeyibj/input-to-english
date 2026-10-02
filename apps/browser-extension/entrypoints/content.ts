import { defineContentScript } from 'wxt/utils/define-content-script';

import { startEditorObserver } from '../src/content/mount';
import { createActiveProvider } from '../src/content/provider-factory';
import type { RuntimeMessage } from '../src/messaging/protocol';
import { selectSiteAdapter } from '../src/sites/select-adapter';

export default defineContentScript({
  matches: ['https://chatgpt.com/*', 'https://claude.ai/*', 'https://gemini.google.com/*', 'https://x.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    const adapter = selectSiteAdapter(location.hostname);
    if (!adapter) return;

    const runtimeClient = { sendMessage: (message: RuntimeMessage) =>
      browser.runtime.sendMessage(message) };
    const provider = createActiveProvider({ runtimeClient });
    void provider.refreshSelection().catch(() => undefined);
    const stop = startEditorObserver(document, adapter, { provider });
    ctx.onInvalidated(stop);
  },
});

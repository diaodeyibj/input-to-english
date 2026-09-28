import { defineBackground } from 'wxt/utils/define-background';

import { handleRuntimeMessage } from '../src/messaging/background-handler';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown) => handleRuntimeMessage(message));
});

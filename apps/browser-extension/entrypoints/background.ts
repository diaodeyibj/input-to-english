import { defineBackground } from 'wxt/utils/define-background';

import { handleRuntimeMessage } from '../src/messaging/background-handler';
import { serializeRuntimeError } from '../src/messaging/protocol';

export default defineBackground(() => {
  const storageReady = browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    void storageReady
      .then(() => handleRuntimeMessage(message))
      .then(sendResponse, () => sendResponse(serializeRuntimeError(null)));
    return true;
  });
});

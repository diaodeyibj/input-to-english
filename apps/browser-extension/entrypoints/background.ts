import { defineBackground } from 'wxt/utils/define-background';

import { handleRuntimeMessage } from '../src/messaging/background-handler';
import { serializeRuntimeError } from '../src/messaging/protocol';

export default defineBackground(() => {
  const toolbarAction = chrome.action ?? chrome.browserAction;
  toolbarAction?.onClicked.addListener(() => {
    void chrome.runtime.openOptionsPage();
  });
  const storageReady = browser.storage.local
    .setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
    .then(() => true, () => false);
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    void storageReady
      .then((ready) => ready ? handleRuntimeMessage(message) : serializeRuntimeError(null))
      .then(sendResponse, () => sendResponse(serializeRuntimeError(null)));
    return true;
  });
});

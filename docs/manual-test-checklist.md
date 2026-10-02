# Manual test checklist

Use a fresh production build for each browser. Record the browser version, build path, date, tester, and evidence before changing any result from `NOT RUN`.

## Gemini / X Edge acceptance — 2026-10-02

This section supersedes the old two-site permission inventory below. Current permissions are the four site origins (`chatgpt.com`, `claude.ai`, `gemini.google.com`, `x.com`), the two cloud API origins, and local storage. No new translation provider or settings migration was added.

| Check | Result / evidence |
| --- | --- |
| Authenticated Gemini DOM inspection | PASS in the **in-app browser**, not Edge: `input-area-v2`, `rich-textarea .ql-editor[role=textbox]`, `.ql-clipboard` excluded; native send button in `[data-test-id=send-button-container]` |
| Authenticated X DOM inspection | PASS in the **in-app browser**, not Edge: Draft `tweetTextarea_0`, nested `data-block` paragraphs, `tweetButtonInline`; modal uses `tweetButton`. `@alice`, `#中文`, URL and ZWJ emoji remain textual Draft entities. Test text was cleared without publishing. |
| Initial user Edge feedback | X translation initially passed, but translated text could not be deleted: **FAIL**. Gemini control briefly appeared then disappeared: **FAIL**. Scope, browser version and provider were not recorded. |
| Updated Edge build after fixes | Awaiting user reload and retest. Follow-up: X still changed focus and Browser Local intermittently showed a background-connection error; new fixes separate these two paths. Edge is not connected to the browser tool; logged-in in-app pages do not load this unpacked extension. |

Load/reload `F:\chatGPT\Second-Class\.output\edge-mv3` in `edge://extensions`, grant Gemini/X site access, select an existing provider, and refresh the website tabs. Run the following in Edge before recording production readiness:

- [ ] Gemini: focus the prompt on both the welcome page and an existing conversation; check one control at the actual text input’s upper right (not the page lower left), resize the window and expand multiline input, then translate, continue typing and deleting without rollback, Undo restores exact original, uploads remain attached. **NOT RUN — requires loaded Edge extension.**
- [ ] X: confirm EN mouse clicks keep the current caret while the provider runs; failed writes restore the caret, keyboard activation still works, and moving focus to another page action is not undone by a late response. Repeat on home posting, post modal, inline reply, reply modal, quote commentary and each thread entry. After translation, Backspace and select-all/Delete work, continued typing persists and the native counter updates. Only user-authored input changes; original quoted posts and reply context remain intact. **NOT RUN — requires loaded Edge extension.**
- [ ] Before focus no control selects an arbitrary composer. Switch between home/modal/thread editors while translating: old input must remain unchanged and old Undo must not return. Own control buttons retain their target. **NOT RUN — requires loaded Edge extension.**
- [ ] Translate `你好 @alice #中文 https://example.com 👩🏽‍💻 🇨🇳 1️⃣` with blank/trailing lines; identifiers, URLs, emoji and exact line breaks survive each configured provider and Undo. **NOT RUN — requires loaded Edge extension and providers.**
- [ ] Add an attachment, translate text, and verify attachment/context stay present. Unsupported in-editor chips must show an error without rewriting them. **NOT RUN — requires loaded Edge extension.**
- [ ] Translate long text past X's current account limit: full output remains, native counter updates, no extension truncation or publication occurs. **NOT RUN — requires loaded Edge extension.**
- [ ] Edit during a request, close a modal, navigate, or remove a thread entry; late results never write into another or removed editor. **NOT RUN — requires loaded Edge extension.**
- [ ] X Enter and Shift+Enter remain line breaks; IME confirmation is not submission. Submission/shortcut event ownership and Undo invalidation are covered automatically; verify actual sending only with an explicitly approved disposable post. **NOT RUN — requires loaded Edge extension.**
- [ ] X DMs/Grok and unrelated search/edit fields have no translation controls. **NOT RUN — requires loaded Edge extension.**
- [ ] Regression: ChatGPT/Claude translation, continuation typing, Undo and navigation. **NOT RUN — requires loaded Edge extension and site sessions.**

Automated tests cover the synthetic DOM and provider boundaries; they do not prove Draft/Quill framework acceptance in Edge. Latest automated results and review findings are recorded in `docs/gemini-x-implementation.md`.

## Test record

| Field | Value |
| --- | --- |
| Date | 2026-09-29 |
| Tester | Codex Task 14 automated verification environment |
| Chrome version | NOT RUN — an interactive Chrome session with extension loading is unavailable in this environment |
| Edge version | NOT RUN — an interactive Edge session with extension loading is unavailable in this environment |
| Chrome build | `.output/chrome-mv3` |
| Edge build | `.output/edge-mv3` |

Result values: `PASS`, `FAIL`, or `NOT RUN — <exact prerequisite>`.

## Installation and permissions

- [ ] Chrome: load `.output/chrome-mv3` unpacked and confirm there are no install errors. **NOT RUN — requires an interactive Chrome extensions page.**
- [ ] Edge: load `.output/edge-mv3` unpacked and confirm there are no install errors. **NOT RUN — requires an interactive Edge extensions page.**
- [ ] In both browsers, inspect extension permissions and confirm access is limited to ChatGPT, Claude, official DeepSeek/Kimi API origins, and local extension storage. **NOT RUN — requires both installed browser builds.**
- [ ] Open Options and confirm local/cloud privacy labels are visible before configuring a provider. **NOT RUN — requires an installed build in an interactive browser.**

## Website integration

Run every item once on ChatGPT and once on Claude in both Chrome and Edge.

- [ ] Focus the prompt editor and confirm one `-> EN` control appears beside the active editor. **NOT RUN — requires authenticated ChatGPT and Claude sessions in both browsers.**
- [ ] Navigate within each single-page application, start a new chat, and confirm the control remounts once without duplicates. **NOT RUN — requires authenticated ChatGPT and Claude sessions in both browsers.**
- [ ] Replace or remount the editor through normal site navigation and confirm the old control no longer responds. **NOT RUN — requires authenticated ChatGPT and Claude sessions in both browsers.**
- [ ] Translate a non-English prompt and confirm translation changes the editor but never submits or sends it. **NOT RUN — requires authenticated ChatGPT and Claude sessions plus a configured provider.**
- [ ] Submit manually after translation and confirm the prompt is sent only by the site's own submit action. **NOT RUN — requires authenticated ChatGPT and Claude sessions plus a configured provider.**

## Browser Local provider

Run in both supported browsers after Options reports Browser Local available. A first use may download a language pack.
On a cold start, if language detection has not finished while the prompt is being typed, the first click may show a local preparation message. Keep the prompt unchanged, wait for preparation, and click again. The Translator API requires a detected source language before its model can be created with user activation.

- [ ] Chinese input translates to English without submitting. **NOT RUN — requires Browser Local capability and an authenticated supported-site session.**
- [ ] Japanese input translates to English without submitting. **NOT RUN — requires Browser Local capability and an authenticated supported-site session.**
- [ ] French input translates to English without submitting. **NOT RUN — requires Browser Local capability and an authenticated supported-site session.**
- [ ] Already-English input remains unchanged and reports that it is already English. **NOT RUN — requires Browser Local language detection and an authenticated supported-site session.**
- [ ] During a first-time language-pack download, the control shows download progress and later completes translation. **NOT RUN — requires a source-language pack that is not already installed.**

## DeepSeek provider

- [ ] Save a user-owned DeepSeek key and valid model ID; confirm the key field becomes masked/retained without exposing the value. **NOT RUN — requires a user-owned DeepSeek API key.**
- [ ] Test the connection and translate a prompt on ChatGPT and Claude. **NOT RUN — requires a funded/authorized DeepSeek API key and authenticated site sessions.**
- [ ] Use an invalid key and confirm a safe authentication error appears while the original prompt remains unchanged. **NOT RUN — requires an interactive browser and a deliberately invalid DeepSeek key.**
- [ ] Delete the saved key and confirm DeepSeek reports that configuration is required. **NOT RUN — requires a previously saved test key in an interactive browser.**

## Kimi provider

- [ ] Save a user-owned Kimi key and valid model ID; confirm the key field becomes masked/retained without exposing the value. **NOT RUN — requires a user-owned Kimi API key.**
- [ ] Test the connection and translate a prompt on ChatGPT and Claude. **NOT RUN — requires a funded/authorized Kimi API key and authenticated site sessions.**
- [ ] Use an invalid key and confirm a safe authentication error appears while the original prompt remains unchanged. **NOT RUN — requires an interactive browser and a deliberately invalid Kimi key.**
- [ ] Delete the saved key and confirm Kimi reports that configuration is required. **NOT RUN — requires a previously saved test key in an interactive browser.**

## Safety and race handling

Repeat with at least one available local provider and one configured cloud provider.

- [ ] Trigger a provider error and confirm the original/current prompt is preserved. **NOT RUN — requires an installed extension and a controllable provider failure.**
- [ ] Start translation, edit the prompt before the response returns, and confirm the newer text is not overwritten. **NOT RUN — requires an installed extension and a provider response slow enough to edit during the request.**
- [ ] Translate successfully, press **Undo**, and confirm the exact original text is restored. **NOT RUN — requires an installed extension and a successful translation.**
- [ ] Translate successfully, edit the result, and confirm **Undo** is invalidated. **NOT RUN — requires an installed extension and a successful translation.**
- [ ] Translate successfully, submit or navigate, and confirm **Undo** is invalidated. **NOT RUN — requires an authenticated supported-site session and a successful translation.**
- [ ] Start a second translation while the first is no longer active and confirm a stale result cannot overwrite the current editor. **NOT RUN — requires an installed extension and controlled response timing.**

## Automated verification record

The following checks ran on 2026-09-29. Automated checks do not substitute for the interactive browser checks above.

| Check | Result |
| --- | --- |
| `npm test` | PASS — 23 test files, 200 tests |
| `npm run typecheck` | PASS |
| `npm run build:chrome` | PASS — `.output/chrome-mv3` |
| `npm run build:edge` | PASS — `.output/edge-mv3` |
| Generated manifest audit | PASS — MV3, exact five host permissions, exact two content-script site matches, no `<all_urls>`, no sync permission, no remote script |
| Content-bundle privilege scan | PASS — no settings-storage key, cloud/local API origin, `Authorization`, or `storage.local` marker in either content script |
| `npm run zip:chrome` | PASS — `.output/input-to-english-0.1.0-chrome.zip` |
| `npm run zip:edge` | PASS — `.output/input-to-english-0.1.0-edge.zip` |
| Archive content audit | PASS — each archive contains its manifest, background worker, and content script |
| Credential-shaped string scan | PASS — no `sk-*` value matching the audit pattern in repository files or artifacts |

## Runtime reconnection check — 2026-10-02
- After reloading the extension, refresh existing website tabs before testing; an invalidated old content-script context cannot reconnect by retrying its button.
- For Browser Local, repeat EN without reloading between attempts. Confirm no background-connectivity error with an active extension worker.
- If the error persists after refreshing, inspect Input to English errors/service-worker status in `edge://extensions`; capture only the error message and browser version, without credentials or draft content.

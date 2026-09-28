# Manual test checklist

Use a fresh production build for each browser. Record the browser version, build path, date, tester, and evidence before changing any result from `NOT RUN`.

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
- [ ] In both browsers, inspect extension permissions and confirm access is limited to ChatGPT, Claude, official DeepSeek/Kimi API origins, local Ollama, and local extension storage. **NOT RUN — requires both installed browser builds.**
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

## Ollama provider

- [ ] Start Ollama at `http://localhost:11434`, refresh models, and confirm installed model names appear. **NOT RUN — requires an interactive installed extension connected to the local Ollama service.**
- [ ] Select and save an installed model, test the connection, and translate on ChatGPT and Claude. **NOT RUN — requires a locally installed Ollama model and authenticated site sessions.**
- [ ] Stop Ollama and confirm the unavailable error preserves the original prompt. **NOT RUN — requires control of a local Ollama service from an interactive browser session.**
- [ ] Remove or select a missing model and confirm the missing-model error preserves the original prompt. **NOT RUN — requires a disposable Ollama model configuration.**

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
| `npm test` | PASS — 23 test files, 186 tests |
| `npm run typecheck` | PASS |
| `npm run build:chrome` | PASS — `.output/chrome-mv3` |
| `npm run build:edge` | PASS — `.output/edge-mv3` |
| Generated manifest audit | PASS — MV3, exact five host permissions, exact two content-script site matches, no `<all_urls>`, no sync permission, no remote script |
| Content-bundle privilege scan | PASS — no settings-storage key, cloud/local API origin, `Authorization`, or `storage.local` marker in either content script |
| `npm run zip:chrome` | PASS — `.output/input-to-english-0.1.0-chrome.zip` |
| `npm run zip:edge` | PASS — `.output/input-to-english-0.1.0-edge.zip` |
| Archive content audit | PASS — each archive contains its manifest, background worker, and content script |
| Credential-shaped string scan | PASS — no `sk-*` value matching the audit pattern in repository files or artifacts |

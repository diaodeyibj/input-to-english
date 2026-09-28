# Input to English

Input to English is a Manifest V3 browser extension for Chrome and Edge. It adds a compact `-> EN` control beside the active prompt editor on ChatGPT and Claude. Pressing the control translates the current prompt into English in place. It never submits the prompt.

The first release supports:

- ChatGPT at `https://chatgpt.com`
- Claude at `https://claude.ai`
- Browser Local Translation
- DeepSeek with your own API key
- Kimi with your own API key
- A locally running Ollama service at `http://localhost:11434`

## Prerequisites

- A current Node.js LTS release with npm
- Chrome 138 or later for Browser Local Translation
- Edge 148 or later for Browser Local Translation
- An authenticated ChatGPT or Claude session for normal use
- Optional: a DeepSeek or Kimi API key for the matching cloud provider
- Optional: Ollama running locally with at least one installed chat model

Browser Local support is determined by the browser at runtime. Browser version alone does not guarantee that every source-language pack is available.

## Install dependencies and verify

```console
npm install
npm test
npm run typecheck
```

Build both browser targets:

```console
npm run build:chrome
npm run build:edge
```

The unpacked extensions are written to:

- `.output/chrome-mv3`
- `.output/edge-mv3`

Optional zip archives can be created with:

```console
npm run zip:chrome
npm run zip:edge
```

## Load the unpacked extension

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `.output/chrome-mv3`.

### Edge

1. Open `edge://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `.output/edge-mv3`.

After loading the extension, open its **Options** page to select and configure one provider. Reload an already-open ChatGPT or Claude tab after installing or rebuilding the extension.

## Use it

1. Open ChatGPT or Claude and focus the prompt editor.
2. Enter a prompt in Chinese, Japanese, French, or another supported source language.
3. Press `-> EN`.
4. Review the English replacement, then submit it yourself if it is correct.
5. Press **Undo** to restore the original prompt while Undo is still available.

Undo is deliberately invalidated after you edit or submit the translated prompt, start another translation, navigate, or allow the Undo window to expire. If the prompt changes while a translation request is running, the extension keeps the newer prompt instead of overwriting it.

## Configure providers

Only the selected provider is used. The extension does not silently fall back to another provider.

### Browser Local

Browser Local keeps prompt text on the device and uses the browser's Language Detector and Translator APIs. In Options, select **Browser Local** and press **Check availability**.

The browser may download a language model the first time a particular language pair is used. Keep the browser open and retry after the download finishes. If Browser Local remains unavailable, update the browser and confirm that its built-in AI language features are enabled and supported on the device.

### DeepSeek

1. Select **DeepSeek** in Options.
2. Enter your DeepSeek API key and model ID.
3. Press **Save credentials** and then **Test connection**.

The default model ID is `deepseek-flash`, and it can be edited. Translated prompt text is sent to the official DeepSeek API only when DeepSeek is selected and you press `-> EN`.

### Kimi

1. Select **Kimi** in Options.
2. Enter your Kimi API key and model ID.
3. Press **Save credentials** and then **Test connection**.

The default model ID is `kimi-k2.6`, and it can be edited. Translated prompt text is sent to the official Kimi API only when Kimi is selected and you press `-> EN`.

### Ollama

1. Install and start Ollama locally.
2. Install at least one suitable model, for example with `ollama pull <model>`.
3. Open the extension Options page and select **Ollama**.
4. Press **Refresh models**, choose a model, press **Save model**, and then **Test connection**.

Version 1 always connects to `http://localhost:11434`. Remote and LAN Ollama endpoints are intentionally unsupported.

## Privacy and security

- Settings and API keys are stored only in extension-local storage; sync storage is not used.
- API keys stay in the background extension context and are not placed in ChatGPT or Claude page content.
- Browser Local and Ollama keep prompt text on this device.
- DeepSeek and Kimi send only the prompt being translated to the selected provider's official API.
- There is no translation history, telemetry, account system, or automatic provider fallback.
- The extension requests access only to ChatGPT, Claude, the two official cloud API origins, and local Ollama.

Never commit real API keys to this repository or paste them into issue reports.

## Troubleshooting

### The `-> EN` control is missing

- Confirm the page is `chatgpt.com` or `claude.ai`.
- Focus the site's active prompt editor.
- Reload the tab after installing, updating, or rebuilding the extension.
- Confirm the matching unpacked build is enabled on the browser's extensions page.

### Browser Local is unavailable or downloading

- Use Chrome 138+ or Edge 148+.
- Open Options and press **Check availability**.
- Keep the browser open while the required language pack downloads.
- Retry on a supported device and source language if the browser reports the pair unavailable.

### DeepSeek or Kimi reports an invalid key

- Re-enter the key in Options and press **Save credentials**.
- Confirm the selected model ID exists for that account.
- Press **Test connection** before returning to ChatGPT or Claude.
- If you no longer want a stored key, press **Delete API key**.

### DeepSeek or Kimi reports a rate limit or service error

Check the provider account quota and service status, then retry later. The extension will not switch providers automatically; choose another provider explicitly if desired.

### Ollama is unavailable or no models appear

- Confirm Ollama is running at `http://localhost:11434`.
- Open that address or run `ollama list` locally to confirm the service responds.
- Install a model, return to Options, and press **Refresh models** again.
- If a saved model was removed, select and save an installed replacement.

### Translation failed but my prompt is still present

This is the expected safety behavior. On provider errors, timeouts, malformed responses, or edits during a request, the extension preserves the current prompt and shows a user-safe error.

## Manual verification

The repeatable browser checklist and execution record are in [docs/manual-test-checklist.md](docs/manual-test-checklist.md).

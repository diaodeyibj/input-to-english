# Input-to-English Browser Extension Design

> **Historical design record:** This documents the original release design. Local Ollama support was later retired and is not part of the current extension. See the current [README](../../../README.md) for supported providers.

**Date:** 2026-09-28  
**Status:** Approved
**Initial platforms:** Google Chrome and Microsoft Edge  
**Initial websites:** ChatGPT and Claude

## 1. Purpose

Build a personal browser extension that converts a completed prompt from any supported source language into English with one click before the prompt is sent to an AI service. The product is intended to improve response speed, throughput, token efficiency, and consistency when the downstream model performs best with English input.

The first release is deliberately small and optimized for personal use. Its architecture must nevertheless support later expansion into a public browser extension and, potentially, a desktop tool for native ChatGPT and Claude applications.

## 2. Success Criteria

The first release is successful when the user can:

1. Type a non-English prompt in ChatGPT or Claude in Chrome or Edge.
2. Click a compact `-> EN` control beside the active prompt editor.
3. Translate through one explicitly selected provider.
4. Receive English text in the same editor without sending it automatically.
5. Undo the replacement and recover the original text.
6. Configure and test Browser Local Translation, DeepSeek, Kimi, or local Ollama.
7. Understand whether a provider processes text locally or sends it to a cloud service.

The extension must never silently switch from local processing to a cloud provider.

## 3. Scope

### Included in version 1

- Manifest V3 extension for Chrome and Edge.
- ChatGPT and Claude website adapters.
- One-click replacement of non-English input with English.
- A single undo opportunity after successful replacement.
- A fixed user-selected translation provider.
- Browser Local Translation using Language Detector and Translator APIs.
- DeepSeek and Kimi using user-supplied API keys.
- Ollama at `http://localhost:11434` using a locally installed model.
- Settings page, connection tests, model selection, and actionable errors.
- Local-only settings storage.
- Automated tests, production builds, and installation documentation.

### Explicitly excluded from version 1

- Chrome Web Store or Edge Add-ons publication.
- Accounts, billing, subscriptions, or a hosted backend.
- Translation history, cloud sync, telemetry, or analytics.
- Automatic provider fallback.
- English prompt optimization.
- Remote or LAN Ollama endpoints.
- Websites other than ChatGPT and Claude.
- Native desktop application integration.
- Automatic model installation or download for Ollama.

## 4. Product Behavior

### 4.1 Primary interaction

Each supported AI editor receives a compact `-> EN` button. The button is attached by the site adapter and uses isolated styling so that host-page styles do not change its appearance.

Button states are:

- **Idle:** ready to translate.
- **Translating:** shows activity and rejects duplicate clicks.
- **Downloading:** shows language-pack progress when the browser provider requires a model download.
- **Success:** replaces the editor content and exposes `Undo`.
- **Error:** preserves the original text and displays a short, actionable error.

Translation changes the editor contents only. It never submits the prompt.

### 4.2 Replacement safety

When translation starts, the adapter captures the source text and a revision marker. Before applying the result, it compares the live editor value with that marker. If the user edited the prompt while translation was running, the extension does not overwrite the new content and asks the user to translate again.

The undo snapshot is held in memory only. It expires after the user edits the translated content, sends the prompt, starts another translation, navigates away, or after a short UI timeout. No translation history is persisted.

### 4.3 Existing English input

Version 1 does not optimize English prompts. If language detection identifies the text as English, the extension leaves the editor unchanged and reports that the input is already English.

### 4.4 Dynamic pages

ChatGPT and Claude are single-page applications. Each adapter observes relevant DOM changes and reattaches to a recreated editor after navigation or conversation changes. Mounting must be idempotent so that duplicate buttons are never created.

## 5. Architecture

The repository separates portable translation behavior from platform-specific integration:

```text
packages/
  core/                 request, result, error, routing, and provider contracts
  providers/            portable provider logic where platform APIs allow it
  prompt/               translation instructions and format-preservation rules

apps/
  browser-extension/    WXT entrypoints, site adapters, UI, storage, and runtime bridges
  desktop/              reserved future application; not created in version 1
```

The first release creates only the packages required by the browser extension. It must not create a placeholder desktop application.

### 5.1 Portable core

The core package contains no DOM, Chrome, Edge, WXT, or site-specific imports. It defines:

- `TranslationRequest`: source text, detected or declared source language, and target language `en`.
- `TranslationResult`: translated text and provider metadata required for UI status.
- `TranslationError`: stable error codes plus safe user-facing context.
- `TranslationProvider`: availability, optional connection test, and translate operations.
- `TranslationRouter`: invokes only the configured provider and never falls back implicitly.

Storage, network transport, browser model access, and editor access are injected through interfaces. This preserves reuse for a future desktop application.

### 5.2 Browser extension application

The WXT application contains:

- Manifest V3 background service worker.
- ChatGPT and Claude content-script adapters.
- Injected translation control and status UI.
- Options page.
- Browser storage adapter.
- Cloud and localhost network transports.
- Browser Local Translation bridge.

The content script reads and modifies the active editor. Cloud and Ollama requests are sent through the service worker so network permissions and credentials remain outside the host page. The browser translation provider runs in a document-capable extension context because service workers do not expose `window`-based Translator APIs. Availability is always checked at runtime.

### 5.3 Website adapter contract

Each site adapter implements:

- Locate the current prompt editor.
- Read plain text while preserving meaningful line breaks and Markdown.
- Replace the full editor value.
- Dispatch the input events required by the host application.
- Locate a stable control anchor.
- Detect editor recreation, prompt submission, and user edits.
- Mount and unmount UI idempotently.

Site selectors and host-specific event behavior remain inside the adapter. Translation providers never depend on page structure.

## 6. Translation Providers

### 6.1 Browser Local Translation

The provider uses the browser's Language Detector API to identify the source language and Translator API to translate to English. It:

- Uses feature detection rather than user-agent checks.
- Checks language-pair availability before creating a translator.
- Reports model download status.
- Keeps input on the device.
- Works offline after the required language pack is installed.
- Reports unsupported browser versions, missing APIs, and unsupported language pairs without changing the editor.

The supported baseline is Chrome 138 or later and Edge 148 or later. Runtime capability checks remain authoritative.

### 6.2 DeepSeek

DeepSeek uses the user's API key and official API endpoint. The provider uses a configured default model ID while allowing the user to edit that ID in settings. Requests use low-randomness settings and non-streaming responses.

### 6.3 Kimi

Kimi follows the same contract as DeepSeek using the user's API key, official endpoint, and an editable model ID. Shared OpenAI-compatible transport behavior may be reused, but provider-specific authentication, defaults, and error mapping remain isolated.

### 6.4 Ollama

Ollama is fixed to `http://localhost:11434` in version 1. The settings page reads locally installed model names and requires the user to select one. The provider sends a non-streaming chat request and reports service-unavailable, missing-model, and timeout failures distinctly.

The base URL is represented in the internal configuration contract so a later release can support remote instances, but version 1 does not expose or accept a custom address.

### 6.5 Translation instruction

LLM providers receive a strict instruction that requires them to:

- Translate the user's text into English only.
- Never answer, solve, summarize, or comment on the prompt.
- Return no wrapper, explanation, label, or quotation marks.
- Preserve Markdown, code fences, inline code, variables, URLs, lists, and line breaks.
- Preserve proper names and ambiguous technical identifiers when translation would change their meaning.

The original prompt is passed as user data, not interpolated into executable extension code.

## 7. Provider Selection and Failure Policy

The user chooses one provider in the settings page. Every translation invokes that provider only.

There is no automatic fallback in version 1. If a provider fails, the extension:

1. Leaves the prompt unchanged.
2. Shows the specific failure.
3. Allows a retry.
4. May link to settings so the user can test or select another provider manually.

This rule prevents local content from being silently sent to a cloud service.

The default request timeout is 30 seconds. A timeout cancels the pending work where supported and does not apply a late result.

## 8. Settings and Secrets

The options page provides:

- Active provider selection.
- Browser Local Translation availability and language-pack status.
- DeepSeek API key, model ID, connection test, and key deletion.
- Kimi API key, model ID, connection test, and key deletion.
- Ollama connectivity, installed model list, and selected model.
- Clear local-versus-cloud privacy labels.

API keys are stored in extension-local storage only. They are not placed in sync storage, content-script DOM, logs, translation history, or telemetry. Secret fields are masked after entry.

A browser extension cannot make a user-supplied key impossible to extract on a compromised machine. The design reduces exposure through minimal permissions, local-only storage, no logging, and separation from page code.

## 9. Permissions and Security

Permissions are limited to:

- Local extension storage.
- Content-script access to ChatGPT and Claude origins.
- Network access to the official DeepSeek and Kimi API origins.
- Network access to local Ollama.

The final manifest must use exact origins rather than broad `<all_urls>` access. No remotely hosted scripts are allowed. Provider responses are treated as untrusted text and inserted through the site adapter without evaluating HTML or JavaScript.

## 10. User-Facing Errors

The UI maps internal errors into concise actions, including:

- Empty input.
- Input changed while translating.
- Input already English.
- Browser translation API unavailable.
- Unsupported language pair.
- Language model downloading or download failed.
- Invalid or missing API key.
- Provider rate limit.
- Provider timeout or network failure.
- Ollama not running.
- Ollama model missing.
- Host editor not found or changed incompatibly.

Unknown errors preserve the prompt, expose no secret values, and offer retry or settings navigation.

## 11. Technology Choices

- **WXT:** extension structure, Manifest generation, Chrome/Edge builds, and extension entrypoints.
- **TypeScript:** shared contracts and compile-time checks.
- **Native HTML/CSS and lightweight DOM components:** injected control and options UI.
- **Shadow DOM:** style isolation for injected controls.
- **Vitest:** unit and DOM contract tests.
- **Playwright where practical:** extension loading and controlled end-to-end fixtures.

React is intentionally excluded from version 1 because the UI is small and does not justify the runtime and abstraction cost.

## 12. Testing Strategy

Development follows test-driven development for core behavior.

### Unit and contract tests

- Router invokes exactly the selected provider.
- No automatic fallback occurs after failure.
- Provider responses and errors map to stable result types.
- LLM prompts enforce translation-only behavior.
- Settings store keys locally and delete them completely.
- Site adapters read, replace, and undo editor text.
- Changed input is never overwritten by a late translation result.
- Repeated DOM changes do not duplicate the injected UI.

### Integration tests

- Background messaging carries requests and structured results correctly.
- DeepSeek and Kimi transports handle mocked success, authentication, limit, timeout, and malformed responses.
- Ollama model discovery and translation work against mocked localhost responses.
- Browser translation capability states map to the correct UI behavior.

### Manual verification

- Load the unpacked production build in supported Chrome and Edge versions.
- Verify ChatGPT and Claude editor discovery, replacement, undo, and navigation behavior.
- Verify Browser Local Translation with at least Chinese, Japanese, and French inputs.
- Verify configured DeepSeek, Kimi, and Ollama paths when credentials and local models are available.
- Confirm that translation never submits a prompt automatically.
- Inspect the generated manifests for minimal permissions.

Real provider credentials must never be committed or placed in test fixtures.

## 13. Build and Delivery

Version 1 delivers:

- Source code and tests.
- Production Manifest V3 output loadable as an unpacked extension in Chrome and Edge.
- Optional zip artifacts for manual installation or future store preparation.
- Setup instructions for browser-local translation, DeepSeek, Kimi, and Ollama.
- A troubleshooting section for permissions, language-pack downloads, keys, and local Ollama connectivity.

Store submission is a separate future project because it introduces listing assets, policies, review requirements, and public support expectations.

## 14. Future Expansion

### Additional websites

Add a site adapter that implements the existing editor contract. Provider code remains unchanged.

### Additional providers

Add a provider plus its settings schema, connection test, and exact network origin. Site adapters remain unchanged.

### Public product

Potential later work includes accounts, a hosted credential proxy, quotas, billing, telemetry with consent, privacy policy, and store publication. None of these concerns should be embedded into the version 1 core.

### Native desktop applications

A future desktop tool may reuse the core, providers, prompt rules, errors, and settings schema. Its platform layer would supply text through global shortcuts, clipboard workflows, or a floating editor instead of DOM adapters. Tauri is a likely lightweight shell, but no desktop framework is selected or installed in version 1.

The preferred first desktop interaction is a global shortcut plus clipboard replacement because it works across native ChatGPT, Claude, and other applications without per-application UI injection.

## 15. Acceptance Criteria

Version 1 is complete only when:

1. Chrome and Edge production builds succeed.
2. Automated tests pass.
3. ChatGPT and Claude both support one-click translation and undo.
4. A changed prompt is never overwritten by a late result.
5. All four providers have working configuration and explicit error states.
6. Local versus cloud processing is visible to the user.
7. No provider fallback, history, telemetry, or automatic submission exists.
8. Generated permissions are reviewed and limited to the approved origins.
9. Installation and configuration documentation is sufficient to run the unpacked extension.

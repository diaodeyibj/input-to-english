import type { ProviderId } from '../../../../packages/core/src/index';
import { OLLAMA_BASE_URL } from '../../../../packages/providers/src/index';
import type { CloudConfigInput, OptionsSnapshot } from './options-controller';

export interface ProviderStatusMessage {
  kind: 'info' | 'success' | 'error';
  message: string;
}

export interface OptionsViewState extends OptionsSnapshot {
  ollamaModels: string[];
  providerStatus: Partial<Record<ProviderId, ProviderStatusMessage>>;
  pendingAction?: string;
}

export interface OptionsActions {
  selectProvider(id: ProviderId): void | Promise<void>;
  saveCloudConfig(id: 'deepseek' | 'kimi', config: CloudConfigInput): void | Promise<void>;
  deleteApiKey(id: 'deepseek' | 'kimi'): void | Promise<void>;
  testProvider(id: ProviderId): void | Promise<void>;
  refreshOllamaModels(): void | Promise<void>;
  saveOllamaModel(model: string): void | Promise<void>;
}

const providerDetails: Record<ProviderId, {
  name: string;
  location: 'Local' | 'Cloud';
  description: string;
}> = {
  browser: {
    name: 'Browser Local',
    location: 'Local',
    description: 'Uses browser language tools and downloads supported language packs on demand.',
  },
  deepseek: {
    name: 'DeepSeek',
    location: 'Cloud',
    description: 'Sends only the prompt you translate to the official DeepSeek API.',
  },
  kimi: {
    name: 'Kimi',
    location: 'Cloud',
    description: 'Sends only the prompt you translate to the official Kimi API.',
  },
  ollama: {
    name: 'Ollama',
    location: 'Local',
    description: 'Uses a model installed on this device through the local Ollama service.',
  },
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fieldLabel(text: string, htmlFor: string): HTMLLabelElement {
  const label = element('label', 'field-label', text);
  label.htmlFor = htmlFor;
  return label;
}

function actionButton(label: string, action: string, onClick: () => void): HTMLButtonElement {
  const button = element('button', action === 'test-provider' ? 'button button-secondary' : 'button', label);
  button.type = 'button';
  button.dataset.action = action;
  button.addEventListener('click', onClick);
  return button;
}

function addStatus(
  card: HTMLElement,
  id: ProviderId,
  status: OptionsViewState['providerStatus'][ProviderId],
): void {
  if (!status) return;
  const output = element('p', `provider-status provider-status-${status.kind}`, status.message);
  output.dataset.providerStatus = id;
  output.setAttribute('role', status.kind === 'error' ? 'alert' : 'status');
  card.append(output);
}

function createCardShell(
  state: OptionsViewState,
  id: ProviderId,
  actions: OptionsActions,
): { card: HTMLElement; body: HTMLElement } {
  const details = providerDetails[id];
  const card = element('section', 'provider-card');
  card.dataset.provider = id;
  if (state.activeProvider === id) card.dataset.active = 'true';

  const header = element('div', 'provider-header');
  const selectorWrap = element('div', 'provider-selector');
  const radio = element('input');
  radio.type = 'radio';
  radio.name = 'active-provider';
  radio.id = `provider-${id}`;
  radio.value = id;
  radio.checked = state.activeProvider === id;
  radio.addEventListener('change', () => {
    if (radio.checked) void actions.selectProvider(id);
  });
  const titleLabel = fieldLabel(details.name, radio.id);
  titleLabel.className = 'provider-name';
  selectorWrap.append(radio, titleLabel);
  const location = element(
    'span',
    `privacy-chip privacy-chip-${details.location.toLowerCase()}`,
    details.location,
  );
  header.append(selectorWrap, location);

  const description = element('p', 'provider-description', details.description);
  const body = element('div', 'provider-body');
  card.append(header, description, body);
  return { card, body };
}

function addCloudFields(
  body: HTMLElement,
  id: 'deepseek' | 'kimi',
  state: OptionsViewState,
  actions: OptionsActions,
): void {
  const details = state[id];
  const fields = element('div', 'field-grid');
  const keyId = `${id}-api-key`;
  const key = element('input');
  key.id = keyId;
  key.type = 'password';
  key.autocomplete = 'off';
  key.spellcheck = false;
  key.placeholder = details.hasApiKey ? 'Saved — leave blank to keep' : 'Paste API key';
  const keyField = element('div', 'field');
  keyField.append(fieldLabel('API key', keyId), key);

  const modelId = `${id}-model`;
  const model = element('input');
  model.id = modelId;
  model.type = 'text';
  model.value = details.model;
  model.autocomplete = 'off';
  model.spellcheck = false;
  const modelField = element('div', 'field');
  modelField.append(fieldLabel('Model ID', modelId), model);
  fields.append(keyField, modelField);

  const controls = element('div', 'button-row');
  controls.append(
    actionButton('Save credentials', 'save-cloud', () => {
      void actions.saveCloudConfig(id, { apiKey: key.value, model: model.value });
    }),
    actionButton('Delete API key', 'delete-key', () => {
      key.value = '';
      void actions.deleteApiKey(id);
    }),
    actionButton('Test connection', 'test-provider', () => void actions.testProvider(id)),
  );
  body.append(fields, controls);
}

function addBrowserFields(
  body: HTMLElement,
  state: OptionsViewState,
  actions: OptionsActions,
): void {
  const readiness = element('div', 'capability-row');
  const label = element('span', 'capability-label', 'Browser capability');
  const value = element('strong', `capability-value capability-${state.browser.status}`, state.browser.status);
  readiness.append(label, value);
  body.append(
    readiness,
    element('p', 'capability-detail', state.browser.detail ?? 'Capability status unavailable.'),
    actionButton('Check availability', 'test-provider', () => void actions.testProvider('browser')),
  );
}

function addOllamaFields(
  body: HTMLElement,
  state: OptionsViewState,
  actions: OptionsActions,
): void {
  const fields = element('div', 'field-grid');
  const urlId = 'ollama-url';
  const url = element('input');
  url.id = urlId;
  url.type = 'url';
  url.value = OLLAMA_BASE_URL;
  url.readOnly = true;
  const urlField = element('div', 'field');
  urlField.append(fieldLabel('Local service URL', urlId), url);

  const modelId = 'ollama-model';
  const model = element('select');
  model.id = modelId;
  const choices = [...new Set([
    ...(state.ollama.model ? [state.ollama.model] : []),
    ...state.ollamaModels,
  ])];
  const placeholder = element('option', undefined, choices.length === 0
    ? 'Refresh to find installed models'
    : 'Select an installed model');
  placeholder.value = '';
  model.append(placeholder);
  for (const name of choices) {
    const option = element('option', undefined, name);
    option.value = name;
    option.selected = name === state.ollama.model;
    model.append(option);
  }
  const modelField = element('div', 'field');
  modelField.append(fieldLabel('Installed model', modelId), model);
  fields.append(urlField, modelField);

  const controls = element('div', 'button-row');
  controls.append(
    actionButton('Refresh models', 'refresh-models', () => void actions.refreshOllamaModels()),
    actionButton('Save model', 'save-model', () => void actions.saveOllamaModel(model.value)),
    actionButton('Test connection', 'test-provider', () => void actions.testProvider('ollama')),
  );
  body.append(fields, controls);
}

export function renderOptions(
  root: HTMLElement,
  state: OptionsViewState,
  actions: OptionsActions,
): void {
  const content = document.createDocumentFragment();
  const intro = element('header', 'page-header');
  const eyebrow = element('p', 'eyebrow', 'INPUT → ENGLISH');
  const heading = element('h1', undefined, 'Choose the route your words take.');
  const summary = element(
    'p',
    'page-summary',
    'Pick one translation provider. A selection never sends text until you press → EN in ChatGPT or Claude.',
  );
  intro.append(eyebrow, heading, summary);

  const privacy = element('aside', 'privacy-note');
  privacy.setAttribute('aria-label', 'Privacy guide');
  privacy.append(
    element('p', 'privacy-local', 'Local providers keep prompt text on this device.'),
    element('p', 'privacy-cloud', 'Cloud providers send prompt text to the provider you select.'),
  );

  const list = element('div', 'provider-list');
  for (const id of ['browser', 'deepseek', 'kimi', 'ollama'] as const) {
    const { card, body } = createCardShell(state, id, actions);
    if (id === 'browser') addBrowserFields(body, state, actions);
    else if (id === 'ollama') addOllamaFields(body, state, actions);
    else addCloudFields(body, id, state, actions);
    addStatus(card, id, state.providerStatus[id]);
    list.append(card);
  }

  const footer = element(
    'footer',
    'page-footer',
    'API keys stay in extension-local storage. They are never synced or placed in website content.',
  );
  content.append(intro, privacy, list, footer);
  root.replaceChildren(content);
}

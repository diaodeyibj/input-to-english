import type { ProviderId } from '../../../../packages/core/src/index';
import type { CloudConfigInput, OptionsSnapshot } from './options-controller';
import type { DisplayLanguage } from '../storage/settings';

export interface ProviderStatusMessage {
  kind: 'info' | 'success' | 'error';
  message: string;
}

export interface OptionsViewState extends OptionsSnapshot {
  providerStatus: Partial<Record<ProviderId, ProviderStatusMessage>>;
  pendingAction?: string;
}

export interface OptionsActions {
  setDisplayLanguage(language: DisplayLanguage): void | Promise<void>;
  selectProvider(id: ProviderId): void | Promise<void>;
  saveCloudConfig(id: 'deepseek' | 'kimi', config: CloudConfigInput): void | Promise<void>;
  deleteApiKey(id: 'deepseek' | 'kimi'): void | Promise<void>;
  testProvider(id: ProviderId): void | Promise<void>;
}

const pageCopy: Record<DisplayLanguage, {
  language: string;
  heading: string;
  summary: string;
  privacyLocal: string;
  privacyCloud: string;
  footer: string;
}> = {
  'zh-CN': {
    language: '界面语言', heading: '选择你的输入翻译路径。',
    summary: '选择一个翻译服务。在 ChatGPT、Claude、Gemini 或 X 中点击 → EN 时才会翻译你的输入。',
    privacyLocal: '本地服务会将提示文本保留在此设备上。', privacyCloud: '云端服务会将提示文本发送给你选择的服务商。',
    footer: 'API 密钥仅保存在扩展本地，不会同步或写入网站内容。',
  },
  en: {
    language: 'Display language', heading: 'Choose the route your words take.',
    summary: 'Pick one translation provider. Your input is translated only when you press → EN in ChatGPT, Claude, Gemini or X.',
    privacyLocal: 'Local providers keep prompt text on this device.', privacyCloud: 'Cloud providers send prompt text to the provider you select.',
    footer: 'API keys stay in extension-local storage. They are never synced or placed in website content.',
  },
  ja: {
    language: '表示言語', heading: '入力を翻訳する経路を選択します。',
    summary: '翻訳プロバイダーを選択してください。ChatGPT、Claude、Gemini または X で → EN を押したときだけ、入力を翻訳します。',
    privacyLocal: 'ローカルのプロバイダーは、入力テキストをこの端末内に保持します。', privacyCloud: 'クラウドのプロバイダーは、入力テキストを選択したプロバイダーに送信します。',
    footer: 'API キーは拡張機能のローカル ストレージにのみ保存され、同期や Web サイト には書き込まれません。',
  },
};

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

function actionButton(
  id: string,
  label: string,
  action: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = element('button', action === 'test-provider' ? 'button button-secondary' : 'button', label);
  button.id = id;
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
    actionButton(`${id}-save-cloud`, 'Save credentials', 'save-cloud', () => {
      void actions.saveCloudConfig(id, { apiKey: key.value, model: model.value });
    }),
    actionButton(`${id}-delete-key`, 'Delete API key', 'delete-key', () => {
      key.value = '';
      void actions.deleteApiKey(id);
    }),
    actionButton(`${id}-test-provider`, 'Test connection', 'test-provider', () => void actions.testProvider(id)),
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
    actionButton(
      'browser-test-provider',
      'Check availability',
      'test-provider',
      () => void actions.testProvider('browser'),
    ),
  );
}

export function renderOptions(
  root: HTMLElement,
  state: OptionsViewState,
  actions: OptionsActions,
): void {
  const copy = pageCopy[state.displayLanguage ?? 'zh-CN'];
  const drafts = new Map<string, string>();
  for (const id of [
    'deepseek-api-key', 'deepseek-model',
    'kimi-api-key', 'kimi-model',
  ]) {
    const field = root.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
    if (field) drafts.set(id, field.value);
  }
  const focusedId = root.contains(document.activeElement) && document.activeElement instanceof HTMLElement
    ? document.activeElement.id
    : '';
  const content = document.createDocumentFragment();
  const intro = element('header', 'page-header');
  const languageField = element('div', 'language-field');
  const language = element('select');
  language.id = 'display-language';
  language.setAttribute('aria-label', copy.language);
  for (const [value, label] of [['zh-CN', '中文'], ['en', 'English'], ['ja', '日本語']] as const) {
    const option = element('option', undefined, label);
    option.value = value;
    option.selected = value === (state.displayLanguage ?? 'zh-CN');
    language.append(option);
  }
  language.addEventListener('change', () => void actions.setDisplayLanguage(language.value as DisplayLanguage));
  languageField.append(fieldLabel(copy.language, language.id), language);
  const eyebrow = element('p', 'eyebrow', 'INPUT → ENGLISH');
  const heading = element('h1', undefined, copy.heading);
  const summary = element(
    'p',
    'page-summary',
    copy.summary,
  );
  intro.append(languageField, eyebrow, heading, summary);

  const privacy = element('aside', 'privacy-note');
  privacy.setAttribute('aria-label', 'Privacy guide');
  privacy.append(
    element('p', 'privacy-local', copy.privacyLocal),
    element('p', 'privacy-cloud', copy.privacyCloud),
  );

  const list = element('div', 'provider-list');
  for (const id of ['browser', 'deepseek', 'kimi'] as const) {
    const { card, body } = createCardShell(state, id, actions);
    if (id === 'browser') addBrowserFields(body, state, actions);
    else addCloudFields(body, id, state, actions);
    addStatus(card, id, state.providerStatus[id]);
    list.append(card);
  }

  const footer = element(
    'footer',
    'page-footer',
    copy.footer,
  );
  content.append(intro, privacy, list, footer);
  root.replaceChildren(content);
  for (const [id, value] of drafts) {
    const field = root.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
    if (field) field.value = value;
  }
  if (focusedId) {
    const replacement = document.getElementById(focusedId);
    if (replacement instanceof HTMLElement && root.contains(replacement)) {
      replacement.focus({ preventScroll: true });
    }
  }
}

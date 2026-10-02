import './style.css';

import {
  TranslationError,
  type ConnectionTestResult,
  type ProviderId,
} from '../../../../packages/core/src/index';
import {
  OptionsController,
  type CloudConfigInput,
  type OptionsSnapshot,
} from '../../src/options/options-controller';
import {
  renderOptions,
  type OptionsActions,
  type OptionsViewState,
  type ProviderStatusMessage,
} from '../../src/options/render-options';
import type { DisplayLanguage } from '../../src/storage/settings';

export interface OptionsControllerLike {
  load(): Promise<OptionsSnapshot>;
  saveProvider(id: ProviderId): Promise<OptionsSnapshot>;
  saveDisplayLanguage(language: DisplayLanguage): Promise<OptionsSnapshot>;
  saveCloudConfig(id: 'deepseek' | 'kimi', config: CloudConfigInput): Promise<OptionsSnapshot>;
  deleteApiKey(id: 'deepseek' | 'kimi'): Promise<OptionsSnapshot>;
  testProvider(id: ProviderId): Promise<ConnectionTestResult>;
}

function safeMessage(cause: unknown): string {
  return cause instanceof TranslationError
    ? cause.userMessage
    : 'The settings action could not be completed.';
}

function loadFailure(root: HTMLElement, cause: unknown): void {
  const panel = document.createElement('section');
  panel.className = 'load-error';
  panel.setAttribute('role', 'alert');
  const title = document.createElement('h1');
  title.textContent = 'Settings could not be loaded';
  const detail = document.createElement('p');
  detail.textContent = safeMessage(cause);
  panel.append(title, detail);
  root.replaceChildren(panel);
}

export async function startOptionsPage(
  root: HTMLElement,
  controller: OptionsControllerLike = new OptionsController(),
): Promise<void> {
  let state: OptionsViewState;
  try {
    state = {
      ...(await controller.load()),
      providerStatus: {},
    };
  } catch (cause) {
    loadFailure(root, cause);
    return;
  }

  const draw = () => renderOptions(root, state, actions);
  const status = (id: ProviderId, next: ProviderStatusMessage) => {
    state = {
      ...state,
      providerStatus: { ...state.providerStatus, [id]: next },
    };
    draw();
  };
  const updateSnapshot = (snapshot: OptionsSnapshot, id: ProviderId, message: string) => {
    state = {
      ...state,
      ...snapshot,
      providerStatus: {
        ...state.providerStatus,
        [id]: { kind: 'success', message },
      },
    };
    draw();
  };
  const runMutation = async (
    id: ProviderId,
    action: () => Promise<OptionsSnapshot>,
    successMessage: string,
    afterSuccess?: () => void,
  ) => {
    try {
      updateSnapshot(await action(), id, successMessage);
      afterSuccess?.();
    } catch (cause) {
      status(id, { kind: 'error', message: safeMessage(cause) });
    }
  };

  const actions: OptionsActions = {
    async setDisplayLanguage(language) {
      state = {
        ...(await controller.saveDisplayLanguage(language)),
        providerStatus: {},
      };
      document.documentElement.lang = language;
      document.title = language === 'zh-CN'
        ? '输入转英文 — 设置'
        : language === 'ja'
          ? '入力を英語に — 設定'
          : 'Input to English — Settings';
      draw();
    },
    async selectProvider(id) {
      await runMutation(id, () => controller.saveProvider(id), 'Active provider updated.');
    },
    async saveCloudConfig(id, config) {
      await runMutation(id, () => controller.saveCloudConfig(id, config), 'Credentials saved locally.', () => {
        const field = root.querySelector<HTMLInputElement>(`#${id}-api-key`);
        if (field?.value === config.apiKey) field.value = '';
      });
    },
    async deleteApiKey(id) {
      await runMutation(id, () => controller.deleteApiKey(id), 'API key deleted.');
    },
    async testProvider(id) {
      const result = await controller.testProvider(id);
      status(id, result.ok
        ? { kind: 'success', message: result.detail }
        : { kind: 'error', message: result.error.userMessage });
    },
  };

  draw();
}

const app = document.querySelector<HTMLElement>('#app');
if (app) void startOptionsPage(app);

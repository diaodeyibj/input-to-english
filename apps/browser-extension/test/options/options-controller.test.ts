import { describe, expect, it } from 'vitest';

import type {
  ConnectionTestResult,
  ProviderAvailability,
  ProviderId,
} from '../../../../packages/core/src/index';
import type { RuntimeMessage } from '../../src/messaging/protocol';
import {
  OptionsController,
  type BrowserCapabilityBridge,
  type OptionsSettingsStore,
} from '../../src/options/options-controller';
import {
  DEFAULT_SETTINGS,
  type ExtensionSettings,
  type ExtensionSettingsPatch,
} from '../../src/storage/settings';

function cloneSettings(settings: ExtensionSettings): ExtensionSettings {
  return {
    activeProvider: settings.activeProvider,
    deepseek: { ...settings.deepseek },
    kimi: { ...settings.kimi },
    ollama: { ...settings.ollama },
  };
}

function createMemoryStore(initial: ExtensionSettings = DEFAULT_SETTINGS) {
  let settings = cloneSettings(initial);
  const store: OptionsSettingsStore = {
    async get() {
      return cloneSettings(settings);
    },
    async update(patch: ExtensionSettingsPatch) {
      settings = {
        activeProvider: patch.activeProvider ?? settings.activeProvider,
        deepseek: { ...settings.deepseek, ...patch.deepseek },
        kimi: { ...settings.kimi, ...patch.kimi },
        ollama: { ...settings.ollama, ...patch.ollama },
      };
      return cloneSettings(settings);
    },
    async clearApiKey(provider: 'deepseek' | 'kimi') {
      settings = { ...settings, [provider]: { ...settings[provider], apiKey: '' } };
      return cloneSettings(settings);
    },
  };
  return { store, current: () => cloneSettings(settings) };
}

function setup(options: {
  settings?: ExtensionSettings;
  availability?: ProviderAvailability;
  send?: (message: RuntimeMessage) => Promise<unknown>;
} = {}) {
  const memory = createMemoryStore(options.settings);
  const sent: RuntimeMessage[] = [];
  const browserCapability: BrowserCapabilityBridge = {
    availability: async () => options.availability ?? {
      status: 'available',
      detail: 'Browser language tools are ready.',
    },
  };
  const controller = new OptionsController({
    settings: memory.store,
    browserCapability,
    runtimeClient: {
      async sendMessage(message) {
        sent.push(message);
        return options.send?.(message) ?? {
          ok: true,
          type: 'test-provider',
          result: { ok: true, detail: 'Connection successful.' },
        };
      },
    },
  });
  return { controller, sent, current: memory.current };
}

describe('OptionsController', () => {
  it('loads defaults and exposes only masked secret metadata', async () => {
    const settings: ExtensionSettings = {
      ...cloneSettings(DEFAULT_SETTINGS),
      deepseek: { apiKey: 'deepseek-secret', model: 'deepseek-custom' },
    };
    const { controller } = setup({ settings });

    const state = await controller.load();

    expect(state).toEqual({
      activeProvider: 'browser',
      browser: { status: 'available', detail: 'Browser language tools are ready.' },
      deepseek: { hasApiKey: true, model: 'deepseek-custom' },
      kimi: { hasApiKey: false, model: DEFAULT_SETTINGS.kimi.model },
      ollama: { model: '' },
    });
    expect(JSON.stringify(state)).not.toContain('deepseek-secret');
  });

  it('switches the selected provider without translating or testing a connection', async () => {
    const { controller, sent, current } = setup();

    const state = await controller.saveProvider('kimi');

    expect(state.activeProvider).toBe('kimi');
    expect(current().activeProvider).toBe('kimi');
    expect(sent).toEqual([]);
  });

  it('rejects a blank new key, then saves and deletes a cloud key without exposing it', async () => {
    const { controller, current } = setup();

    await expect(controller.saveCloudConfig('deepseek', {
      apiKey: '   ',
      model: 'deepseek-chat',
    })).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
      userMessage: 'Enter a DeepSeek API key before saving.',
    });
    expect(current().deepseek.apiKey).toBe('');

    const saved = await controller.saveCloudConfig('deepseek', {
      apiKey: '  sk-private-value  ',
      model: '  deepseek-chat  ',
    });
    expect(current().deepseek).toEqual({ apiKey: 'sk-private-value', model: 'deepseek-chat' });
    expect(saved.deepseek).toEqual({ hasApiKey: true, model: 'deepseek-chat' });
    expect(JSON.stringify(saved)).not.toContain('sk-private-value');

    const deleted = await controller.deleteApiKey('deepseek');
    expect(current().deepseek.apiKey).toBe('');
    expect(deleted.deepseek.hasApiKey).toBe(false);
  });

  it('keeps an existing key when an explicit model save leaves the masked key input blank', async () => {
    const settings: ExtensionSettings = {
      ...cloneSettings(DEFAULT_SETTINGS),
      kimi: { apiKey: 'saved-kimi-secret', model: 'old-model' },
    };
    const { controller, current } = setup({ settings });

    await controller.saveCloudConfig('kimi', { apiKey: '', model: 'new-model' });

    expect(current().kimi).toEqual({ apiKey: 'saved-kimi-secret', model: 'new-model' });
  });

  it('returns safe remote connection-test outcomes without changing the selected provider', async () => {
    const { controller, sent, current } = setup({
      send: async (message) => message.type === 'test-provider' && message.providerId === 'kimi'
        ? {
            ok: false,
            error: {
              code: 'AUTHENTICATION_FAILED',
              userMessage: 'Authentication failed.',
              retryable: false,
            },
          }
        : {
            ok: true,
            type: 'test-provider',
            result: { ok: true, detail: 'Connection successful.' },
          },
    });

    const deepseek = await controller.testProvider('deepseek');
    const kimi = await controller.testProvider('kimi');

    expect(deepseek).toEqual({ ok: true, detail: 'Connection successful.' });
    expect(kimi).toMatchObject({
      ok: false,
      error: { code: 'AUTHENTICATION_FAILED', userMessage: 'Authentication failed.' },
    });
    expect(current().activeProvider).toBe('browser');
    expect(sent).toEqual([
      { type: 'test-provider', providerId: 'deepseek' },
      { type: 'test-provider', providerId: 'kimi' },
    ]);
  });

  it('lists installed Ollama models and saves an explicit selection locally', async () => {
    const { controller, sent, current } = setup({
      send: async (message) => message.type === 'list-ollama-models'
        ? { ok: true, type: 'list-ollama-models', models: ['qwen2.5:7b', 'gemma3:4b'] }
        : { ok: false },
    });

    await expect(controller.listOllamaModels()).resolves.toEqual(['qwen2.5:7b', 'gemma3:4b']);
    const state = await controller.saveOllamaModel(' qwen2.5:7b ');

    expect(state.ollama.model).toBe('qwen2.5:7b');
    expect(current().ollama.model).toBe('qwen2.5:7b');
    expect(sent).toEqual([{ type: 'list-ollama-models' }]);
  });

  it('reports browser capability locally without sending a runtime message', async () => {
    const { controller, sent } = setup({
      availability: { status: 'downloadable', detail: 'Language tools download on first use.' },
    });

    const result: ConnectionTestResult = await controller.testProvider('browser');

    expect(result).toEqual({ ok: true, detail: 'Language tools download on first use.' });
    expect(sent).toEqual([]);
  });

  it.each<ProviderId>(['browser', 'deepseek', 'kimi', 'ollama'])(
    'never includes stored credentials in the %s load result',
    async () => {
      const settings: ExtensionSettings = {
        ...cloneSettings(DEFAULT_SETTINGS),
        deepseek: { apiKey: 'first-secret', model: 'deepseek' },
        kimi: { apiKey: 'second-secret', model: 'kimi' },
      };
      const { controller } = setup({ settings });
      expect(JSON.stringify(await controller.load())).not.toMatch(/first-secret|second-secret/);
    },
  );
});

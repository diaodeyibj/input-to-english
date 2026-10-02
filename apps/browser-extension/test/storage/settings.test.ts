import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SettingsStore,
} from '../../src/storage/settings';

type StoredValues = Record<string, unknown>;

function installLocalStorage(initial: StoredValues = {}) {
  const values = { ...initial };
  const local = {
    get: vi.fn(async (key: string) => ({ [key]: values[key] })),
    set: vi.fn(async (next: StoredValues) => Object.assign(values, next)),
  };
  vi.stubGlobal('browser', { storage: { local } });
  return { local, values };
}

afterEach(() => vi.unstubAllGlobals());

describe('SettingsStore', () => {
  it('merges missing and malformed persisted fields with individual defaults', async () => {
    installLocalStorage({
      [SETTINGS_STORAGE_KEY]: {
        activeProvider: 'deepseek',
        deepseek: { apiKey: 42, model: 'custom-deepseek' },
        kimi: 'invalid',
      },
    });

    await expect(new SettingsStore().get()).resolves.toEqual({
      displayLanguage: 'zh-CN',
      activeProvider: 'deepseek',
      deepseek: { apiKey: '', model: 'custom-deepseek' },
      kimi: DEFAULT_SETTINGS.kimi,
    });
  });

  it('removes legacy Ollama settings and resets a retired active provider safely', async () => {
    const { local, values } = installLocalStorage({
      [SETTINGS_STORAGE_KEY]: {
        ...DEFAULT_SETTINGS,
        activeProvider: 'ollama',
        displayLanguage: 'ja',
        kimi: { ...DEFAULT_SETTINGS.kimi, apiKey: 'keep-this-key' },
        ollama: { model: 'legacy-model' },
      },
    });

    await expect(new SettingsStore().get()).resolves.toMatchObject({
      activeProvider: 'browser',
      displayLanguage: 'ja',
      kimi: { apiKey: 'keep-this-key' },
    });
    expect(local.set).toHaveBeenCalledOnce();
    expect(values[SETTINGS_STORAGE_KEY]).not.toHaveProperty('ollama');
  });

  it('reads and writes only browser.storage.local', async () => {
    const { local, values } = installLocalStorage();
    const store = new SettingsStore();

    await store.update({ deepseek: { model: 'my-model' } });

    expect(local.get).toHaveBeenCalledWith(SETTINGS_STORAGE_KEY);
    expect(local.set).toHaveBeenCalledWith({
      [SETTINGS_STORAGE_KEY]: expect.objectContaining({
        deepseek: { apiKey: '', model: 'my-model' },
      }),
    });
    expect(values[SETTINGS_STORAGE_KEY]).toEqual(expect.objectContaining({
      deepseek: { apiKey: '', model: 'my-model' },
    }));
  });

  it('clears an API key by persisting an empty string', async () => {
    const { values } = installLocalStorage({
      [SETTINGS_STORAGE_KEY]: {
        ...DEFAULT_SETTINGS,
        kimi: { ...DEFAULT_SETTINGS.kimi, apiKey: 'secret' },
      },
    });

    await new SettingsStore().clearApiKey('kimi');

    expect(values[SETTINGS_STORAGE_KEY]).toEqual(expect.objectContaining({
      kimi: expect.objectContaining({ apiKey: '' }),
    }));
  });

  it('returns fresh settings without aliases to defaults or prior results', async () => {
    installLocalStorage();
    const store = new SettingsStore();
    const first = await store.get();
    first.deepseek.model = 'mutated';
    const second = await store.get();

    expect(second.deepseek.model).toBe(DEFAULT_SETTINGS.deepseek.model);
    expect(second).not.toBe(DEFAULT_SETTINGS);
    expect(second.deepseek).not.toBe(DEFAULT_SETTINGS.deepseek);
  });

  it('persists the chosen settings-page display language', async () => {
    const { values } = installLocalStorage();

    await new SettingsStore().update({ displayLanguage: 'ja' });

    expect(values[SETTINGS_STORAGE_KEY]).toEqual(expect.objectContaining({ displayLanguage: 'ja' }));
    await expect(new SettingsStore().get()).resolves.toEqual(expect.objectContaining({ displayLanguage: 'ja' }));
  });
});

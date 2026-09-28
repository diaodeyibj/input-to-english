import {
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_KIMI_MODEL,
} from '../../../../packages/providers/src/index';
import type { ProviderId } from '../../../../packages/core/src/index';

export const SETTINGS_STORAGE_KEY = 'inputToEnglish.settings.v1';

export interface ExtensionSettings {
  activeProvider: ProviderId;
  deepseek: { apiKey: string; model: string };
  kimi: { apiKey: string; model: string };
  ollama: { model: string };
}

export type ExtensionSettingsPatch = {
  activeProvider?: ProviderId;
  deepseek?: Partial<ExtensionSettings['deepseek']>;
  kimi?: Partial<ExtensionSettings['kimi']>;
  ollama?: Partial<ExtensionSettings['ollama']>;
};

interface LocalStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
}

declare const browser: { storage: { local: LocalStorageArea } };

export const DEFAULT_SETTINGS: ExtensionSettings = {
  activeProvider: 'browser',
  deepseek: { apiKey: '', model: DEFAULT_DEEPSEEK_MODEL },
  kimi: { apiKey: '', model: DEFAULT_KIMI_MODEL },
  ollama: { model: '' },
};

const providerIds: readonly ProviderId[] = ['browser', 'deepseek', 'kimi', 'ollama'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && providerIds.includes(value as ProviderId);
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function cloneSettings(settings: ExtensionSettings): ExtensionSettings {
  return {
    activeProvider: settings.activeProvider,
    deepseek: { ...settings.deepseek },
    kimi: { ...settings.kimi },
    ollama: { ...settings.ollama },
  };
}

export function sanitizeSettings(value: unknown): ExtensionSettings {
  const stored = isRecord(value) ? value : {};
  const deepseek = isRecord(stored.deepseek) ? stored.deepseek : {};
  const kimi = isRecord(stored.kimi) ? stored.kimi : {};
  const ollama = isRecord(stored.ollama) ? stored.ollama : {};

  return {
    activeProvider: isProviderId(stored.activeProvider)
      ? stored.activeProvider
      : DEFAULT_SETTINGS.activeProvider,
    deepseek: {
      apiKey: stringOrDefault(deepseek.apiKey, DEFAULT_SETTINGS.deepseek.apiKey),
      model: stringOrDefault(deepseek.model, DEFAULT_SETTINGS.deepseek.model),
    },
    kimi: {
      apiKey: stringOrDefault(kimi.apiKey, DEFAULT_SETTINGS.kimi.apiKey),
      model: stringOrDefault(kimi.model, DEFAULT_SETTINGS.kimi.model),
    },
    ollama: {
      model: stringOrDefault(ollama.model, DEFAULT_SETTINGS.ollama.model),
    },
  };
}

function mergePatch(current: ExtensionSettings, patch: ExtensionSettingsPatch): ExtensionSettings {
  const next = cloneSettings(current);
  if (isProviderId(patch.activeProvider)) next.activeProvider = patch.activeProvider;

  if (isRecord(patch.deepseek)) {
    next.deepseek.apiKey = stringOrDefault(patch.deepseek.apiKey, next.deepseek.apiKey);
    next.deepseek.model = stringOrDefault(patch.deepseek.model, next.deepseek.model);
  }
  if (isRecord(patch.kimi)) {
    next.kimi.apiKey = stringOrDefault(patch.kimi.apiKey, next.kimi.apiKey);
    next.kimi.model = stringOrDefault(patch.kimi.model, next.kimi.model);
  }
  if (isRecord(patch.ollama)) {
    next.ollama.model = stringOrDefault(patch.ollama.model, next.ollama.model);
  }
  return next;
}

export class SettingsStore {
  async get(): Promise<ExtensionSettings> {
    const stored = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
    return sanitizeSettings(stored[SETTINGS_STORAGE_KEY]);
  }

  async update(patch: ExtensionSettingsPatch): Promise<ExtensionSettings> {
    const settings = mergePatch(await this.get(), patch);
    await browser.storage.local.set({ [SETTINGS_STORAGE_KEY]: cloneSettings(settings) });
    return cloneSettings(settings);
  }

  async clearApiKey(provider: 'deepseek' | 'kimi'): Promise<ExtensionSettings> {
    return this.update({ [provider]: { apiKey: '' } });
  }
}

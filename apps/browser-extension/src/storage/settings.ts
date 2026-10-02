import {
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_KIMI_MODEL,
} from '../../../../packages/providers/src/index';
import type { ProviderId } from '../../../../packages/core/src/index';

export const SETTINGS_STORAGE_KEY = 'inputToEnglish.settings.v1';
export type DisplayLanguage = 'zh-CN' | 'en' | 'ja';

export interface ExtensionSettings {
  displayLanguage?: DisplayLanguage;
  activeProvider: ProviderId;
  deepseek: { apiKey: string; model: string };
  kimi: { apiKey: string; model: string };
}

export type ExtensionSettingsPatch = {
  displayLanguage?: DisplayLanguage;
  activeProvider?: ProviderId;
  deepseek?: Partial<ExtensionSettings['deepseek']>;
  kimi?: Partial<ExtensionSettings['kimi']>;
};

interface LocalStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
}

declare const browser: { storage: { local: LocalStorageArea } };

export const DEFAULT_SETTINGS: ExtensionSettings = {
  displayLanguage: 'zh-CN',
  activeProvider: 'browser',
  deepseek: { apiKey: '', model: DEFAULT_DEEPSEEK_MODEL },
  kimi: { apiKey: '', model: DEFAULT_KIMI_MODEL },
};

const providerIds: readonly ProviderId[] = ['browser', 'deepseek', 'kimi'];
const displayLanguages: readonly DisplayLanguage[] = ['zh-CN', 'en', 'ja'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && providerIds.includes(value as ProviderId);
}

function isDisplayLanguage(value: unknown): value is DisplayLanguage {
  return typeof value === 'string' && displayLanguages.includes(value as DisplayLanguage);
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function cloneSettings(settings: ExtensionSettings): ExtensionSettings {
  return {
    displayLanguage: settings.displayLanguage ?? DEFAULT_SETTINGS.displayLanguage,
    activeProvider: settings.activeProvider,
    deepseek: { ...settings.deepseek },
    kimi: { ...settings.kimi },
  };
}

export function sanitizeSettings(value: unknown): ExtensionSettings {
  const stored = isRecord(value) ? value : {};
  const deepseek = isRecord(stored.deepseek) ? stored.deepseek : {};
  const kimi = isRecord(stored.kimi) ? stored.kimi : {};

  return {
    displayLanguage: isDisplayLanguage(stored.displayLanguage)
      ? stored.displayLanguage
      : DEFAULT_SETTINGS.displayLanguage,
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
  };
}

function mergePatch(current: ExtensionSettings, patch: ExtensionSettingsPatch): ExtensionSettings {
  const next = cloneSettings(current);
  if (isDisplayLanguage(patch.displayLanguage)) next.displayLanguage = patch.displayLanguage;
  if (isProviderId(patch.activeProvider)) next.activeProvider = patch.activeProvider;

  if (isRecord(patch.deepseek)) {
    next.deepseek.apiKey = stringOrDefault(patch.deepseek.apiKey, next.deepseek.apiKey);
    next.deepseek.model = stringOrDefault(patch.deepseek.model, next.deepseek.model);
  }
  if (isRecord(patch.kimi)) {
    next.kimi.apiKey = stringOrDefault(patch.kimi.apiKey, next.kimi.apiKey);
    next.kimi.model = stringOrDefault(patch.kimi.model, next.kimi.model);
  }
  return next;
}

export class SettingsStore {
  async get(): Promise<ExtensionSettings> {
    const stored = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
    const raw = stored[SETTINGS_STORAGE_KEY];
    const settings = sanitizeSettings(raw);
    if (isRecord(raw) && ('ollama' in raw || raw.activeProvider === 'ollama')) {
      if (raw.activeProvider === 'ollama') settings.activeProvider = DEFAULT_SETTINGS.activeProvider;
      await browser.storage.local.set({ [SETTINGS_STORAGE_KEY]: cloneSettings(settings) });
    }
    return settings;
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

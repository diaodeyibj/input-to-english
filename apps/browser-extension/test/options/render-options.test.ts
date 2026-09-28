// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProviderId } from '../../../../packages/core/src/index';
import {
  renderOptions,
  type OptionsActions,
  type OptionsViewState,
} from '../../src/options/render-options';
import { startOptionsPage, type OptionsControllerLike } from '../../entrypoints/options/main';

const baseState: OptionsViewState = {
  activeProvider: 'browser',
  browser: { status: 'available', detail: 'Browser language tools are ready.' },
  deepseek: { hasApiKey: true, model: 'deepseek-flash' },
  kimi: { hasApiKey: false, model: 'kimi-k2.6' },
  ollama: { model: '' },
  ollamaModels: ['qwen2.5:7b', 'gemma3:4b'],
  providerStatus: {},
};

function actions(): OptionsActions {
  return {
    selectProvider: vi.fn(),
    saveCloudConfig: vi.fn(),
    deleteApiKey: vi.fn(),
    testProvider: vi.fn(),
    refreshOllamaModels: vi.fn(),
    saveOllamaModel: vi.fn(),
  };
}

function mount(state: OptionsViewState = baseState, handlers: OptionsActions = actions()) {
  const root = document.createElement('main');
  document.body.append(root);
  renderOptions(root, state, handlers);
  return { root, handlers };
}

function providerCard(root: HTMLElement, id: ProviderId): HTMLElement {
  const card = root.querySelector<HTMLElement>(`[data-provider="${id}"]`);
  if (!card) throw new Error(`Missing provider card: ${id}`);
  return card;
}

afterEach(() => document.body.replaceChildren());

describe('renderOptions', () => {
  it('renders every provider with clear local and cloud privacy labels', () => {
    const { root } = mount();

    expect(providerCard(root, 'browser').textContent).toContain('Browser Local');
    expect(providerCard(root, 'browser').textContent).toContain('Local');
    expect(providerCard(root, 'ollama').textContent).toContain('Ollama');
    expect(providerCard(root, 'ollama').textContent).toContain('Local');
    expect(providerCard(root, 'deepseek').textContent).toContain('DeepSeek');
    expect(providerCard(root, 'deepseek').textContent).toContain('Cloud');
    expect(providerCard(root, 'kimi').textContent).toContain('Kimi');
    expect(providerCard(root, 'kimi').textContent).toContain('Cloud');
    expect(root.textContent).toContain('Local providers keep prompt text on this device.');
    expect(root.textContent).toContain('Cloud providers send prompt text to the provider you select.');
  });

  it('uses associated masked key fields, editable cloud models, and a fixed Ollama URL', () => {
    const { root } = mount();
    const deepseekKey = root.querySelector<HTMLInputElement>('#deepseek-api-key')!;
    const kimiKey = root.querySelector<HTMLInputElement>('#kimi-api-key')!;
    const deepseekModel = root.querySelector<HTMLInputElement>('#deepseek-model')!;
    const kimiModel = root.querySelector<HTMLInputElement>('#kimi-model')!;
    const ollamaUrl = root.querySelector<HTMLInputElement>('#ollama-url')!;

    expect(deepseekKey.type).toBe('password');
    expect(kimiKey.type).toBe('password');
    expect(deepseekKey.value).toBe('');
    expect(deepseekKey.placeholder).toContain('Saved');
    expect(root.querySelector(`label[for="${deepseekKey.id}"]`)).not.toBeNull();
    expect(root.querySelector(`label[for="${kimiKey.id}"]`)).not.toBeNull();
    expect(deepseekModel.readOnly).toBe(false);
    expect(kimiModel.readOnly).toBe(false);
    expect(ollamaUrl.value).toBe('http://localhost:11434');
    expect(ollamaUrl.readOnly).toBe(true);
    expect(root.querySelector(`label[for="${ollamaUrl.id}"]`)).not.toBeNull();
  });

  it('keeps provider selection separate from diagnostics', () => {
    const handlers = actions();
    const { root } = mount(baseState, handlers);
    const kimi = root.querySelector<HTMLInputElement>('#provider-kimi')!;

    kimi.checked = true;
    kimi.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handlers.selectProvider).toHaveBeenCalledWith('kimi');
    expect(handlers.testProvider).not.toHaveBeenCalled();
  });

  it('forwards explicit save, delete, test, refresh, and model-selection actions', () => {
    const handlers = actions();
    const { root } = mount(baseState, handlers);
    const deepseek = providerCard(root, 'deepseek');
    deepseek.querySelector<HTMLInputElement>('#deepseek-api-key')!.value = 'new-key';
    deepseek.querySelector<HTMLInputElement>('#deepseek-model')!.value = 'new-model';

    deepseek.querySelector<HTMLButtonElement>('[data-action="save-cloud"]')!.click();
    deepseek.querySelector<HTMLButtonElement>('[data-action="delete-key"]')!.click();
    deepseek.querySelector<HTMLButtonElement>('[data-action="test-provider"]')!.click();
    providerCard(root, 'ollama')
      .querySelector<HTMLButtonElement>('[data-action="refresh-models"]')!.click();
    const select = root.querySelector<HTMLSelectElement>('#ollama-model')!;
    select.value = 'gemma3:4b';
    providerCard(root, 'ollama')
      .querySelector<HTMLButtonElement>('[data-action="save-model"]')!.click();

    expect(handlers.saveCloudConfig).toHaveBeenCalledWith('deepseek', {
      apiKey: 'new-key', model: 'new-model',
    });
    expect(handlers.deleteApiKey).toHaveBeenCalledWith('deepseek');
    expect(handlers.testProvider).toHaveBeenCalledWith('deepseek');
    expect(handlers.refreshOllamaModels).toHaveBeenCalledOnce();
    expect(handlers.saveOllamaModel).toHaveBeenCalledWith('gemma3:4b');
  });

  it('renders safe status text without placing stored credentials in text or markup', () => {
    const secret = 'sk-do-not-render';
    const { root } = mount({
      ...baseState,
      providerStatus: {
        deepseek: { kind: 'error', message: 'Authentication failed. Check your API key.' },
      },
    });

    expect(root.textContent).toContain('Authentication failed. Check your API key.');
    expect(root.textContent).not.toContain(secret);
    expect(root.innerHTML).not.toContain(secret);
    expect(root.querySelector('[role="alert"]')?.textContent)
      .toBe('Authentication failed. Check your API key.');
  });

  it('uses native keyboard-focusable controls for every action', () => {
    const { root } = mount();
    const controls = [...root.querySelectorAll<HTMLElement>('button, input, select')];

    expect(controls.length).toBeGreaterThan(10);
    expect(controls.every((control) => control.tabIndex >= 0)).toBe(true);
    expect(root.querySelectorAll('button[type="button"]').length).toBeGreaterThan(0);
  });

  it('wires explicit option actions to controller results and rerenders the saved state', async () => {
    let snapshot = {
      activeProvider: baseState.activeProvider,
      browser: baseState.browser,
      deepseek: baseState.deepseek,
      kimi: baseState.kimi,
      ollama: baseState.ollama,
    };
    const events: string[] = [];
    const controller: OptionsControllerLike = {
      async load() { return snapshot; },
      async saveProvider(id) {
        events.push(`select:${id}`);
        snapshot = { ...snapshot, activeProvider: id };
        return snapshot;
      },
      async saveCloudConfig(id) { events.push(`save:${id}`); return snapshot; },
      async deleteApiKey(id) { events.push(`delete:${id}`); return snapshot; },
      async saveOllamaModel(model) {
        events.push(`model:${model}`);
        snapshot = { ...snapshot, ollama: { model } };
        return snapshot;
      },
      async testProvider(id) {
        events.push(`test:${id}`);
        return { ok: true, detail: 'Connection successful.' };
      },
      async listOllamaModels() {
        events.push('models');
        return ['gemma3:4b'];
      },
    };
    const root = document.createElement('main');
    document.body.append(root);

    await startOptionsPage(root, controller);
    const kimi = root.querySelector<HTMLInputElement>('#provider-kimi')!;
    kimi.checked = true;
    kimi.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(
      root.querySelector<HTMLInputElement>('#provider-kimi')?.checked,
    ).toBe(true));
    providerCard(root, 'kimi')
      .querySelector<HTMLButtonElement>('[data-action="test-provider"]')!.click();
    await vi.waitFor(() => expect(providerCard(root, 'kimi').textContent)
      .toContain('Connection successful.'));

    expect(events).toEqual(['select:kimi', 'test:kimi']);
  });
});

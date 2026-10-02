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
  providerStatus: {},
  displayLanguage: 'en',
};

function actions(): OptionsActions {
  return {
    selectProvider: vi.fn(),
    saveCloudConfig: vi.fn(),
    deleteApiKey: vi.fn(),
    testProvider: vi.fn(),
    setDisplayLanguage: vi.fn(),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

afterEach(() => document.body.replaceChildren());

describe('renderOptions', () => {
  it('renders every provider with clear local and cloud privacy labels', () => {
    const { root } = mount();

    expect(providerCard(root, 'browser').textContent).toContain('Browser Local');
    expect(providerCard(root, 'browser').textContent).toContain('Local');
    expect(providerCard(root, 'deepseek').textContent).toContain('DeepSeek');
    expect(providerCard(root, 'deepseek').textContent).toContain('Cloud');
    expect(providerCard(root, 'kimi').textContent).toContain('Kimi');
    expect(providerCard(root, 'kimi').textContent).toContain('Cloud');
    expect(root.textContent).toContain('Local providers keep prompt text on this device.');
    expect(root.textContent).toContain('Cloud providers send prompt text to the provider you select.');
  });

  it('renders a three-language selector and uses the selected Japanese interface copy', () => {
    const handlers = actions();
    const { root } = mount({ ...baseState, displayLanguage: 'ja' }, handlers);
    const language = root.querySelector<HTMLSelectElement>('#display-language')!;

    expect([...language.options].map((option) => option.value)).toEqual(['zh-CN', 'en', 'ja']);
    expect(language.value).toBe('ja');
    expect(root.textContent).toContain('表示言語');

    language.value = 'zh-CN';
    language.dispatchEvent(new Event('change', { bubbles: true }));
    expect(handlers.setDisplayLanguage).toHaveBeenCalledWith('zh-CN');
  });

  it('uses associated masked key fields and editable cloud models', () => {
    const { root } = mount();
    const deepseekKey = root.querySelector<HTMLInputElement>('#deepseek-api-key')!;
    const kimiKey = root.querySelector<HTMLInputElement>('#kimi-api-key')!;
    const deepseekModel = root.querySelector<HTMLInputElement>('#deepseek-model')!;
    const kimiModel = root.querySelector<HTMLInputElement>('#kimi-model')!;

    expect(deepseekKey.type).toBe('password');
    expect(kimiKey.type).toBe('password');
    expect(deepseekKey.value).toBe('');
    expect(deepseekKey.placeholder).toContain('Saved');
    expect(root.querySelector(`label[for="${deepseekKey.id}"]`)).not.toBeNull();
    expect(root.querySelector(`label[for="${kimiKey.id}"]`)).not.toBeNull();
    expect(deepseekModel.readOnly).toBe(false);
    expect(kimiModel.readOnly).toBe(false);
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

  it('forwards cloud actions', () => {
    const handlers = actions();
    const { root } = mount(baseState, handlers);
    const deepseek = providerCard(root, 'deepseek');
    deepseek.querySelector<HTMLInputElement>('#deepseek-api-key')!.value = 'new-key';
    deepseek.querySelector<HTMLInputElement>('#deepseek-model')!.value = 'new-model';

    deepseek.querySelector<HTMLButtonElement>('[data-action="save-cloud"]')!.click();
    deepseek.querySelector<HTMLButtonElement>('[data-action="delete-key"]')!.click();
    deepseek.querySelector<HTMLButtonElement>('[data-action="test-provider"]')!.click();

    expect(handlers.saveCloudConfig).toHaveBeenCalledWith('deepseek', {
      apiKey: 'new-key', model: 'new-model',
    });
    expect(handlers.deleteApiKey).toHaveBeenCalledWith('deepseek');
    expect(handlers.testProvider).toHaveBeenCalledWith('deepseek');
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

  it('restores keyboard focus to the same stable control after a redraw', () => {
    const { root, handlers } = mount();
    const radio = root.querySelector<HTMLInputElement>('#provider-kimi')!;
    radio.focus();

    renderOptions(root, { ...baseState, activeProvider: 'kimi' }, handlers);
    expect(document.activeElement?.id).toBe('provider-kimi');

    const save = root.querySelector<HTMLButtonElement>('#deepseek-save-cloud')!;
    save.focus();
    renderOptions(root, baseState, handlers);
    expect(document.activeElement?.id).toBe('deepseek-save-cloud');
  });

  it('preserves unsaved cloud drafts when an unrelated async status redraws the page', async () => {
    const { root, handlers } = mount();
    root.querySelector<HTMLInputElement>('#deepseek-api-key')!.value = 'draft-deepseek-key';
    root.querySelector<HTMLInputElement>('#deepseek-model')!.value = 'draft-deepseek-model';
    root.querySelector<HTMLInputElement>('#kimi-api-key')!.value = 'draft-kimi-key';
    root.querySelector<HTMLInputElement>('#kimi-model')!.value = 'draft-kimi-model';

    await Promise.resolve();
    renderOptions(root, {
      ...baseState,
      providerStatus: { browser: { kind: 'success', message: 'Available now.' } },
    }, handlers);

    expect(root.querySelector<HTMLInputElement>('#deepseek-api-key')?.value).toBe('draft-deepseek-key');
    expect(root.querySelector<HTMLInputElement>('#deepseek-model')?.value).toBe('draft-deepseek-model');
    expect(root.querySelector<HTMLInputElement>('#kimi-api-key')?.value).toBe('draft-kimi-key');
    expect(root.querySelector<HTMLInputElement>('#kimi-model')?.value).toBe('draft-kimi-model');
  });

  it('clears a secret draft after its save and delete actions complete', async () => {
    let snapshot = {
      activeProvider: baseState.activeProvider,
      browser: baseState.browser,
      deepseek: baseState.deepseek,
      kimi: baseState.kimi,
    };
    const controller: OptionsControllerLike = {
      async load() { return snapshot; },
      async saveProvider() { return snapshot; },
      async saveDisplayLanguage() { return snapshot; },
      async saveCloudConfig(id, config) {
        snapshot = { ...snapshot, [id]: { hasApiKey: true, model: config.model } };
        return snapshot;
      },
      async deleteApiKey(id) {
        snapshot = { ...snapshot, [id]: { ...snapshot[id], hasApiKey: false } };
        return snapshot;
      },
      async testProvider() { return { ok: true, detail: 'Connected.' }; },
    };
    const root = document.createElement('main');
    document.body.append(root);
    await startOptionsPage(root, controller);

    root.querySelector<HTMLInputElement>('#deepseek-api-key')!.value = 'first-secret';
    root.querySelector<HTMLButtonElement>('#deepseek-save-cloud')!.click();
    await vi.waitFor(() => expect(providerCard(root, 'deepseek').textContent)
      .toContain('Credentials saved locally.'));
    expect(root.querySelector<HTMLInputElement>('#deepseek-api-key')?.value).toBe('');

    root.querySelector<HTMLInputElement>('#deepseek-api-key')!.value = 'second-secret';
    root.querySelector<HTMLButtonElement>('#deepseek-delete-key')!.click();
    await vi.waitFor(() => expect(providerCard(root, 'deepseek').textContent)
      .toContain('API key deleted.'));
    expect(root.querySelector<HTMLInputElement>('#deepseek-api-key')?.value).toBe('');
  });

  it('preserves a newer unsaved cloud key when an earlier save completes', async () => {
    let snapshot = {
      activeProvider: baseState.activeProvider,
      browser: baseState.browser,
      deepseek: baseState.deepseek,
      kimi: baseState.kimi,
    };
    const saved = deferred<typeof snapshot>();
    const controller: OptionsControllerLike = {
      async load() { return snapshot; },
      async saveProvider() { return snapshot; },
      async saveDisplayLanguage() { return snapshot; },
      async saveCloudConfig() { return saved.promise; },
      async deleteApiKey() { return snapshot; },
      async testProvider() { return { ok: true, detail: 'Connected.' }; },
    };
    const root = document.createElement('main');
    document.body.append(root);
    await startOptionsPage(root, controller);

    const key = root.querySelector<HTMLInputElement>('#deepseek-api-key')!;
    key.value = 'submitted-key-A';
    root.querySelector<HTMLButtonElement>('#deepseek-save-cloud')!.click();
    key.value = 'new-unsaved-key-B';
    saved.resolve({
      ...snapshot,
      deepseek: { hasApiKey: true, model: snapshot.deepseek.model },
    });

    await vi.waitFor(() => expect(providerCard(root, 'deepseek').textContent)
      .toContain('Credentials saved locally.'));
    expect(root.querySelector<HTMLInputElement>('#deepseek-api-key')?.value).toBe('new-unsaved-key-B');
  });

  it('wires explicit option actions to controller results and rerenders the saved state', async () => {
    let snapshot = {
      activeProvider: baseState.activeProvider,
      browser: baseState.browser,
      deepseek: baseState.deepseek,
      kimi: baseState.kimi,
    };
    const events: string[] = [];
    const controller: OptionsControllerLike = {
      async load() { return snapshot; },
      async saveProvider(id) {
        events.push(`select:${id}`);
        snapshot = { ...snapshot, activeProvider: id };
        return snapshot;
      },
      async saveDisplayLanguage() { return snapshot; },
      async saveCloudConfig(id) { events.push(`save:${id}`); return snapshot; },
      async deleteApiKey(id) { events.push(`delete:${id}`); return snapshot; },
      async testProvider(id) {
        events.push(`test:${id}`);
        return { ok: true, detail: 'Connection successful.' };
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

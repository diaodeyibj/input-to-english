import type { TranslationProvider } from '../../../../packages/core/src/index';
import type { LanguageDetectionBridge } from '../../../../packages/providers/src/browser-local';
import type { EditorHandle, SiteAdapter } from '../sites/editor-adapter';
import { createTranslateControl, type TranslateControl } from '../ui/translate-control';
import { TranslationController } from './translation-controller';

export interface MountDependencies {
  provider: TranslationProvider;
  detector?: LanguageDetectionBridge;
}

export interface MountedControl {
  readonly editor: EditorHandle;
  readonly control: TranslateControl;
  dispose(): void;
}

const mounts = new WeakMap<Document, MountedControl>();

function disposeMounted(document: Document): void {
  mounts.get(document)?.dispose();
}

export function mountForActiveEditor(
  document: Document,
  adapter: SiteAdapter,
  dependencies: MountDependencies,
): MountedControl | null {
  const editor = adapter.findEditor(document);
  const anchor = editor && adapter.findControlAnchor(editor);
  const existing = mounts.get(document);
  if (!editor || !anchor || !anchor.isConnected) {
    existing?.dispose();
    return null;
  }
  if (existing?.editor.element === editor.element &&
      existing.control.element.isConnected && existing.control.element.parentElement === anchor) {
    return existing;
  }
  existing?.dispose();

  const controller = new TranslationController({
    editor,
    provider: dependencies.provider,
    detector: dependencies.detector,
    isPromptSubmitted: adapter.isPromptSubmitted,
  });
  const control = createTranslateControl();
  control.element.setAttribute('data-input-to-english-root', 'v1');
  control.bind(controller);
  anchor.append(control.element);

  let disposed = false;
  const mounted: MountedControl = {
    editor,
    control,
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.dispose();
      control.dispose();
      if (mounts.get(document) === mounted) mounts.delete(document);
    },
  };
  mounts.set(document, mounted);
  return mounted;
}

/** Keep one control attached to the currently eligible editor through SPA changes. */
export function startEditorObserver(
  document: Document,
  adapter: SiteAdapter,
  dependencies: MountDependencies,
): () => void {
  const view = document.defaultView;
  let stopped = false;
  let queued = false;
  let href = view?.location.href;
  let current: MountedControl | null = null;

  const reconcile = (): void => {
    if (stopped) return;
    const nextHref = view?.location.href;
    if (href !== nextHref) {
      current?.dispose();
      href = nextHref;
    }
    current = mountForActiveEditor(document, adapter, dependencies);
  };
  const schedule = (): void => {
    if (stopped || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      reconcile();
    });
  };
  const observer = new MutationObserver(schedule);
  const navigation = (view as (Window & { navigation?: EventTarget }) | null)?.navigation;
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }
  view?.addEventListener('popstate', schedule);
  view?.addEventListener('hashchange', schedule);
  view?.addEventListener('pageshow', schedule);
  navigation?.addEventListener('currententrychange', schedule);
  reconcile();

  return () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    view?.removeEventListener('popstate', schedule);
    view?.removeEventListener('hashchange', schedule);
    view?.removeEventListener('pageshow', schedule);
    navigation?.removeEventListener('currententrychange', schedule);
    current?.dispose();
    disposeMounted(document);
  };
}

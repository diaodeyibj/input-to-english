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
  focusedTarget?: Element | null,
): MountedControl | null {
  const editor = adapter.findEditor(document, focusedTarget);
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

  const mountedHref = document.defaultView?.location.href;
  const controller = new TranslationController({
    editor,
    provider: dependencies.provider,
    detector: dependencies.detector,
    isPromptSubmitted: adapter.isPromptSubmitted,
    protectContent: adapter.protectContent,
    isCurrentTarget: () => document.defaultView?.location.href === mountedHref &&
      anchor.isConnected && adapter.findEditor(document, editor.element)?.element === editor.element &&
      (!adapter.requiresFocus || editor.element.contains(document.activeElement) ||
        document.activeElement === control.element),
  });
  const control = createTranslateControl();
  control.element.setAttribute('data-input-to-english-root', 'v1');
  if (adapter.id === 'gemini') {
    control.element.style.display = 'block';
    const position = document.defaultView?.getComputedStyle(anchor).position;
    if (position && position !== 'static') {
      control.element.style.position = 'absolute';
      control.element.style.right = '8px';
      control.element.style.bottom = 'calc(100% + 6px)';
      control.element.style.zIndex = '2';
      control.element.style.maxWidth = 'calc(100% - 16px)';
    } else {
      control.element.style.margin = '4px 0';
    }
  }
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
  let focusedTarget: Element | null = document.activeElement;

  const reconcile = (): void => {
    if (stopped) return;
    const nextHref = view?.location.href;
    if (href !== nextHref) {
      current?.dispose();
      focusedTarget = null;
      href = nextHref;
    }
    if (adapter.requiresFocus) {
      const focused = adapter.findEditor(document, document.activeElement);
      if (focused) focusedTarget = focused.element;
    }
    current = mountForActiveEditor(document, adapter, dependencies, focusedTarget);
    if (adapter.requiresFocus && !current) focusedTarget = null;
  };
  const schedule = (): void => {
    if (stopped || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      reconcile();
    });
  };
  const onFocus = (event: FocusEvent): void => {
    if (stopped || !adapter.requiresFocus || !(event.target instanceof Element)) return;
    if (event.target.closest('[data-input-to-english-root]')) return;
    const editor = adapter.findEditor(document, event.target);
    if (editor) {
      if (editor.element !== current?.editor.element) current?.dispose();
      focusedTarget = editor.element;
      reconcile(); // Synchronous: pending provider continuations cannot write the old target.
    } else if (event.target.closest('[contenteditable="true"], textarea, input')) {
      current?.dispose();
      current = null;
      focusedTarget = null;
    }
  };
  const onNavigation = (): void => {
    current?.dispose();
    focusedTarget = null;
    schedule();
  };
  const observer = new MutationObserver(schedule);
  const navigation = (view as (Window & { navigation?: EventTarget }) | null)?.navigation;
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }
  document.addEventListener('focusin', onFocus, true);
  view?.addEventListener('popstate', onNavigation);
  view?.addEventListener('hashchange', onNavigation);
  view?.addEventListener('pageshow', onNavigation);
  navigation?.addEventListener('currententrychange', onNavigation);
  reconcile();

  return () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    document.removeEventListener('focusin', onFocus, true);
    view?.removeEventListener('popstate', onNavigation);
    view?.removeEventListener('hashchange', onNavigation);
    view?.removeEventListener('pageshow', onNavigation);
    navigation?.removeEventListener('currententrychange', onNavigation);
    current?.dispose();
    disposeMounted(document);
  };
}

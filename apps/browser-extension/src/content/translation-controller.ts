import {
  TranslationError,
  withTimeout,
  type TranslationProgress,
  type TranslationProvider,
  type TranslationRequest,
  type TranslationResult,
  type ProviderId,
  type TranslationOptions,
} from '../../../../packages/core/src/index';
import type { LanguageDetectionBridge } from '../../../../packages/providers/src/browser-local';
import type { EditorHandle } from '../sites/editor-adapter';
import { createDocumentBrowserBridges } from './provider-factory';

const ACTION_TIMEOUT_MS = 30_000;

export type ControllerStatus = 'idle' | 'translating' | 'downloading' | 'success' | 'error';

export interface ControllerState {
  status: ControllerStatus;
  canUndo: boolean;
  error?: TranslationError;
  progress?: TranslationProgress;
}

export interface TranslationControllerOptions {
  editor: EditorHandle;
  provider: UserActivatedTranslationProvider;
  detector?: LanguageDetectionBridge;
  isPromptSubmitted?: (event: Event) => boolean;
}

export interface PreparedTranslationAction {
  selectedProvider: Promise<ProviderId>;
  sourceLanguage?: string;
  translate(request: TranslationRequest, options?: TranslationOptions): Promise<TranslationResult>;
  dispose(): void;
}

export interface UserActivatedTranslationProvider extends TranslationProvider {
  prepareInput?(text: string): void;
  beginUserAction?(request: TranslationRequest, options?: TranslationOptions): PreparedTranslationAction;
}

interface UndoRecord {
  original: string;
  translated: string;
  revision: number;
}

function error(code: ConstructorParameters<typeof TranslationError>[0]['code'], message: string): TranslationError {
  return new TranslationError({ code, userMessage: message, retryable: false });
}

function canonicalLanguage(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '' || value === 'und') return undefined;
  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    return undefined;
  }
}

function isCurrent(editor: EditorHandle, text: string, revision: number): boolean {
  return editor.readText() === text && editor.getRevision() === revision;
}

export class TranslationController {
  private readonly editor: EditorHandle;
  private readonly provider: UserActivatedTranslationProvider;
  private readonly detector?: LanguageDetectionBridge;
  private readonly isPromptSubmitted?: (event: Event) => boolean;
  private readonly listeners = new Set<(state: ControllerState) => void>();
  private currentState: ControllerState = { status: 'idle', canUndo: false };
  private active?: AbortController;
  private undoRecord?: UndoRecord;
  private undoTimer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private replacing = false;
  private submitted = false;

  constructor({ editor, provider, detector, isPromptSubmitted }: TranslationControllerOptions) {
    this.editor = editor;
    this.provider = provider;
    this.detector = detector ?? createDocumentBrowserBridges().detector;
    this.isPromptSubmitted = isPromptSubmitted;
    editor.element.addEventListener('input', this.onInput);
    const document = editor.element.ownerDocument;
    document.addEventListener('submit', this.onSubmit, true);
    document.addEventListener('keydown', this.onSubmit, true);
  }

  get state(): ControllerState {
    return this.currentState;
  }

  subscribe(listener: (state: ControllerState) => void): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    try {
      listener(this.currentState);
    } catch {
      this.listeners.delete(listener);
    }
    return () => { this.listeners.delete(listener); };
  }

  async translate(): Promise<void> {
    if (this.disposed || this.active) return;
    this.clearUndo();
    const snapshot = this.editor.readText();
    const revision = this.editor.getRevision();
    if (snapshot.trim().length === 0) {
      this.publish({ status: 'error', canUndo: false,
        error: error('EMPTY_INPUT', 'Enter text before translating.') });
      return;
    }

    const active = new AbortController();
    this.active = active;
    this.submitted = false;
    this.publish({ status: 'translating', canUndo: false });
    try {
      await withTimeout(async (deadlineSignal) => {
        const signal = AbortSignal.any([active.signal, deadlineSignal]);
        const isWorkActive = () => this.isActive(active) && !signal.aborted;
        const translationOptions: TranslationOptions = {
          signal,
          onProgress: (progress) => {
            if (isWorkActive()) {
              this.publish({ status: 'downloading', canUndo: false, progress });
            }
          },
        };
        // beginUserAction runs in the original button event task. It may start
        // browser model creation before waiting for background provider selection.
        const action = this.provider.beginUserAction?.(
          { text: snapshot, targetLanguage: 'en' }, translationOptions,
        );
        try {
          const selectedProvider = action ? await action.selectedProvider : this.provider.id;
          let sourceLanguage: string | undefined;
          if (action?.sourceLanguage) {
            sourceLanguage = action.sourceLanguage;
          } else if (selectedProvider !== 'browser' || !action) {
            if (this.detector) {
              try {
                const detected = await this.detector.detect(snapshot, { signal });
                if (Number.isFinite(detected.confidence) && detected.confidence >= 0.5 &&
                    detected.confidence <= 1) {
                  sourceLanguage = canonicalLanguage(detected.detectedLanguage);
                }
              } catch {
                // Remote providers can translate without source-language detection.
                // Browser Local retains its own defensive detector check.
              }
            }
          }
          if (!isWorkActive()) return;
          if (this.submitted || !isCurrent(this.editor, snapshot, revision)) throw inputChanged();
          if (sourceLanguage?.split('-')[0].toLowerCase() === 'en') {
            throw error('ALREADY_ENGLISH', 'This input is already in English.');
          }

          const request: TranslationRequest = {
            text: snapshot,
            targetLanguage: 'en',
            ...(sourceLanguage === undefined ? {} : { sourceLanguage }),
          };
          const result = await (action
            ? action.translate(request, translationOptions)
            : this.provider.translate(request, translationOptions));
          if (!isWorkActive()) return;
          if (this.submitted || !isCurrent(this.editor, snapshot, revision)) throw inputChanged();
          if (typeof result.text !== 'string' || result.text.trim().length === 0) {
            throw error('MALFORMED_RESPONSE', 'The provider returned no translation.');
          }

          this.replacing = true;
          try {
            this.editor.replaceText(result.text);
          } finally {
            this.replacing = false;
          }
          if (!isWorkActive()) return;
          if (this.submitted) throw inputChanged();
          if (!isCurrent(this.editor, result.text, this.editor.getRevision())) {
            throw error('EDITOR_NOT_FOUND', 'The editor could not be updated. Please try again.');
          }
          this.undoRecord = {
            original: snapshot,
            translated: result.text,
            revision: this.editor.getRevision(),
          };
          this.undoTimer = setTimeout(() => {
            this.clearUndo();
            if (!this.disposed && this.currentState.status === 'success') {
              this.publish({ status: 'idle', canUndo: false });
            }
          }, 10_000);
          this.active = undefined;
          this.publish({ status: 'success', canUndo: true });
        } finally {
          action?.dispose();
        }
      }, ACTION_TIMEOUT_MS);
    } catch (cause) {
      if (!this.isActive(active)) return;
      const failure = this.submitted || !isCurrent(this.editor, snapshot, revision)
        ? inputChanged()
        : cause instanceof TranslationError
          ? cause
          : error('UNKNOWN', 'Translation failed. Please try again.');
      this.active = undefined;
      this.publish({ status: 'error', canUndo: false, error: failure });
    } finally {
      if (this.active === active) this.active = undefined;
    }
  }

  undo(): boolean {
    if (this.disposed || this.active || !this.undoRecord) return false;
    const record = this.undoRecord;
    if (!isCurrent(this.editor, record.translated, record.revision)) {
      this.clearUndo();
      this.publish({ status: 'idle', canUndo: false });
      return false;
    }
    try {
      this.replacing = true;
      this.editor.replaceText(record.original);
      if (this.editor.readText() !== record.original) {
        throw new Error('The host editor changed the restored text.');
      }
      this.clearUndo();
      this.publish({ status: 'idle', canUndo: false });
      return true;
    } catch {
      this.clearUndo();
      this.publish({ status: 'error', canUndo: false,
        error: error('EDITOR_NOT_FOUND', 'The editor could not restore the original text.') });
      return false;
    } finally {
      this.replacing = false;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active?.abort();
    this.active = undefined;
    this.clearUndo();
    this.editor.element.removeEventListener('input', this.onInput);
    const document = this.editor.element.ownerDocument;
    document.removeEventListener('submit', this.onSubmit, true);
    document.removeEventListener('keydown', this.onSubmit, true);
    this.listeners.clear();
  }

  private isActive(active: AbortController): boolean {
    return !this.disposed && this.active === active;
  }

  private publish(state: ControllerState): void {
    if (this.disposed) return;
    this.currentState = state;
    for (const listener of this.listeners) {
      if (this.currentState !== state) break;
      try {
        listener(state);
      } catch {
        this.listeners.delete(listener);
      }
    }
  }

  private clearUndo(): void {
    this.undoRecord = undefined;
    if (this.undoTimer !== undefined) clearTimeout(this.undoTimer);
    this.undoTimer = undefined;
  }

  private readonly onInput = (): void => {
    if (this.replacing || this.disposed) return;
    this.provider.prepareInput?.(this.editor.readText());
    if (this.active) {
      this.active.abort();
      this.active = undefined;
      this.clearUndo();
      this.publish({ status: 'error', canUndo: false, error: inputChanged() });
      return;
    }
    if (!this.undoRecord) return;
    this.clearUndo();
    this.publish({ status: 'idle', canUndo: false });
  };

  private readonly onSubmit = (event: Event): void => {
    if (!this.isPromptSubmitted?.(event) || this.disposed) return;
    const target = event.target;
    const form = this.editor.element.closest('form');
    const belongsToEditor = event.type === 'submit'
      ? target === form
      : target instanceof Node && this.editor.element.contains(target);
    if (!belongsToEditor) return;
    this.submitted = true;
    this.clearUndo();
    if (this.active) {
      this.active.abort();
      this.active = undefined;
      this.publish({ status: 'error', canUndo: false, error: inputChanged() });
    } else this.publish({ status: 'idle', canUndo: false });
  };
}

function inputChanged(): TranslationError {
  return error('INPUT_CHANGED', 'The prompt changed. Translate it again.');
}

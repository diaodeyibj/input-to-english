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
import { detectSourceLanguage, nonLatinText } from '../../../../packages/providers/src/language-detection';
import { EditorWriteError } from '../sites/dom-editor';
import type { EditorHandle } from '../sites/editor-adapter';
import { createDocumentBrowserBridges } from './provider-factory';
import { protectText } from './protected-text';

const ACTION_TIMEOUT_MS = 30_000;

export type ControllerStatus = 'idle' | 'translating' | 'downloading' | 'success' | 'error';

export interface ControllerState {
  status: ControllerStatus;
  canUndo: boolean;
  error?: TranslationError;
  progress?: TranslationProgress;
  recoveryText?: string;
}

export interface TranslationControllerOptions {
  editor: EditorHandle;
  provider: UserActivatedTranslationProvider;
  detector?: LanguageDetectionBridge;
  isPromptSubmitted?: (event: Event, editor: EditorHandle) => boolean;
  protectContent?: boolean;
  isCurrentTarget?: () => boolean;
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

function isCurrent(editor: EditorHandle, text: string, revision: number): boolean {
  return editor.element.isConnected && editor.readText() === text && editor.getRevision() === revision;
}

export class TranslationController {
  private readonly editor: EditorHandle;
  private readonly provider: UserActivatedTranslationProvider;
  private readonly detector?: LanguageDetectionBridge;
  private readonly isPromptSubmitted?: (event: Event, editor: EditorHandle) => boolean;
  private readonly protectContent: boolean;
  private readonly isCurrentTarget: () => boolean;
  private readonly listeners = new Set<(state: ControllerState) => void>();
  private currentState: ControllerState = { status: 'idle', canUndo: false };
  private active?: AbortController;
  private undoRecord?: UndoRecord;
  private undoTimer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private replacing = false;
  private submitted = false;

  constructor({ editor, provider, detector, isPromptSubmitted, protectContent = false,
    isCurrentTarget = () => true }: TranslationControllerOptions) {
    this.editor = editor;
    this.provider = provider;
    this.detector = detector ?? createDocumentBrowserBridges().detector;
    this.isPromptSubmitted = isPromptSubmitted;
    this.protectContent = protectContent;
    this.isCurrentTarget = isCurrentTarget;
    editor.element.addEventListener('input', this.onInput);
    const document = editor.element.ownerDocument;
    document.addEventListener('submit', this.onSubmit, true);
    document.addEventListener('keydown', this.onSubmit, true);
    document.addEventListener('click', this.onSubmit, true);
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
    if (this.disposed || this.active || this.replacing) return;
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
                sourceLanguage = await detectSourceLanguage(snapshot, this.detector, { signal });
              } catch {
                // Remote providers can translate without source-language detection.
                // Browser Local retains its own defensive detector check.
              }
            }
          }
          if (!isWorkActive()) return;
          if (this.submitted || !this.isCurrentEditor(snapshot, revision)) throw inputChanged();
          if (sourceLanguage?.split('-')[0].toLowerCase() === 'en') {
            if (!nonLatinText(snapshot)) {
              throw error('ALREADY_ENGLISH', 'This input is already in English.');
            }
            sourceLanguage = undefined;
          }

          const protectedText = this.protectContent ? protectText(snapshot) : undefined;
          const request: TranslationRequest = {
            text: protectedText?.text ?? snapshot,
            targetLanguage: 'en',
            ...(sourceLanguage === undefined ? {} : { sourceLanguage }),
          };
          const result = await (action
            ? action.translate(request, translationOptions)
            : this.provider.translate(request, translationOptions));
          if (!isWorkActive()) return;
          if (this.submitted || !this.isCurrentEditor(snapshot, revision)) throw inputChanged();
          if (typeof result.text !== 'string' || result.text.trim().length === 0) {
            throw error('MALFORMED_RESPONSE', 'The provider returned no translation.');
          }
          const translated = protectedText ? protectedText.restore(result.text) : result.text;

          this.replacing = true;
          try {
            const writing = this.editor.replaceText(translated,
              () => isWorkActive() && !this.submitted && this.isCurrentTarget());
            if (writing) await writing;
          } finally {
            this.replacing = false;
          }
          if (!isWorkActive()) return;
          if (this.submitted) throw inputChanged();
          if (!this.isCurrentEditor(translated, this.editor.getRevision())) {
            throw error('EDITOR_NOT_FOUND', 'The editor could not be updated. Please try again.');
          }
          this.undoRecord = {
            original: snapshot,
            translated,
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
      const failure = cause instanceof EditorWriteError
        ? error('EDITOR_NOT_FOUND', 'The host editor could not accept the replacement.')
        : this.submitted || !this.isCurrentEditor(snapshot, revision)
        ? inputChanged()
        : cause instanceof TranslationError
          ? cause
          : error('UNKNOWN', 'Translation failed. Please try again.');
      this.active = undefined;
      this.publish({ status: 'error', canUndo: false, error: failure,
        ...(cause instanceof EditorWriteError ? { recoveryText: cause.original } : {}) });
    } finally {
      if (this.active === active) this.active = undefined;
    }
  }

  undo(): boolean | Promise<boolean> {
    if (this.disposed || this.active || this.replacing || !this.undoRecord) return false;
    const record = this.undoRecord;
    if (!this.isCurrentEditor(record.translated, record.revision)) {
      this.clearUndo();
      this.publish({ status: 'idle', canUndo: false });
      return false;
    }
    const finish = (): boolean => {
      if (this.disposed || this.submitted || this.undoRecord !== record ||
          !this.isCurrentTarget() || this.editor.readText() !== record.original) {
        throw new Error('The host editor changed the restored text.');
      }
      this.replacing = false;
      this.clearUndo();
      this.publish({ status: 'idle', canUndo: false });
      return true;
    };
    const failed = (): boolean => {
      this.replacing = false;
      this.clearUndo();
      this.publish({ status: 'error', canUndo: false,
        error: error('EDITOR_NOT_FOUND', 'The editor could not restore the original text.'),
        recoveryText: record.original });
      return false;
    };
    try {
      this.replacing = true;
      const writing = this.editor.replaceText(record.original, () => !this.disposed &&
        !this.submitted && this.undoRecord === record && this.isCurrentTarget());
      if (writing) return writing.then(finish).catch(failed);
      return finish();
    } catch { return failed(); }
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
    document.removeEventListener('click', this.onSubmit, true);
    this.listeners.clear();
  }

  private isActive(active: AbortController): boolean {
    return !this.disposed && this.active === active;
  }

  private isCurrentEditor(text: string, revision: number): boolean {
    return this.isCurrentTarget() && isCurrent(this.editor, text, revision);
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
    if (this.disposed || !this.isPromptSubmitted?.(event, this.editor)) return;
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

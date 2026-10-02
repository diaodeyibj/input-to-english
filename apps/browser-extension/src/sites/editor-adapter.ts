export interface EditorHandle {
  readonly element: HTMLElement;
  readText(): string;
  /** Resolves only when the host accepts the text; rechecks ownership before writing. */
  replaceText(text: string, canWrite?: () => boolean): void | Promise<void>;
  getRevision(): number;
  focus(): void;
}

export interface SiteAdapter {
  readonly id: 'chatgpt' | 'claude' | 'gemini' | 'x';
  readonly requiresFocus?: boolean;
  readonly protectContent?: boolean;
  findEditor(document: Document, focusedTarget?: Element | null): EditorHandle | null;
  findControlAnchor(editor: EditorHandle): HTMLElement | null;
  isPromptSubmitted(event: Event, editor?: EditorHandle): boolean;
}

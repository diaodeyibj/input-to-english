export interface EditorHandle {
  readonly element: HTMLElement;
  readText(): string;
  /** Throws if the host editor cancels beforeinput; a normal return means replacement occurred. */
  replaceText(text: string): void;
  getRevision(): number;
  focus(): void;
}

export interface SiteAdapter {
  readonly id: 'chatgpt' | 'claude';
  findEditor(document: Document): EditorHandle | null;
  findControlAnchor(editor: EditorHandle): HTMLElement | null;
  isPromptSubmitted(event: Event): boolean;
}

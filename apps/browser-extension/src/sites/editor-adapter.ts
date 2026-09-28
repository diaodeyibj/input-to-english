export interface EditorHandle {
  readonly element: HTMLElement;
  readText(): string;
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

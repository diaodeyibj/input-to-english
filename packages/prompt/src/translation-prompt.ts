export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

const translationInstructions = [
  'Translate the user-provided text into English only.',
  'Output only the translation.',
  'Do not answer questions, explain, add commentary, or wrap the output.',
  'Preserve Markdown, code fences, variables, URLs, lists, names, and line breaks.',
].join(' ');

export function buildTranslationMessages(
  text: string,
): readonly [ChatMessage, ChatMessage] {
  return [
    { role: 'system', content: translationInstructions },
    { role: 'user', content: text },
  ];
}

const W = 2800;
const H = 1600;
const FONT = '"Segoe UI", "Microsoft YaHei", "Yu Gothic", "Malgun Gothic", sans-serif';

export interface LocalizedUIOptions {
  host: 'ChatGPT' | 'Claude';
  locale: string;
  value: string;
  focused: boolean;
  /** The caller owns the blink phase and passes whether the caret is visible. */
  caret: boolean;
  pressed?: boolean;
  showEN?: boolean;
}

type Copy = {welcome: string; claudeWelcome: string; placeholder: string; newChat: string; search: string; chats: string; hint: string; footer: string};
const COPY: Record<string, Copy> = {
  zh: {welcome: '有什么可以帮忙的？', claudeWelcome: '今天我能为你做些什么？', placeholder: '输入你的问题', newChat: '新对话', search: '搜索对话', chats: '你的对话', hint: '用你的语言表达，轻松转换为英文。', footer: '可能会出错，请核实重要信息。'},
  ja: {welcome: '何をお手伝いしましょうか？', claudeWelcome: '今日は何をお手伝いしましょうか？', placeholder: '質問を入力してください', newChat: '新しいチャット', search: 'チャットを検索', chats: 'あなたのチャット', hint: 'あなたの言葉を、自然な英語に。', footer: '誤りが含まれる場合があります。重要な情報は確認してください。'},
  ko: {welcome: '무엇을 도와드릴까요?', claudeWelcome: '오늘은 무엇을 도와드릴까요?', placeholder: '질문을 입력하세요', newChat: '새 대화', search: '대화 검색', chats: '내 대화', hint: '내 언어로 쓰고, 자연스러운 영어로 바꾸세요.', footer: '오류가 있을 수 있습니다. 중요한 정보는 확인하세요.'},
  de: {welcome: 'Wie kann ich dir helfen?', claudeWelcome: 'Wie kann ich dir heute helfen?', placeholder: 'Stelle eine Frage', newChat: 'Neuer Chat', search: 'Chats suchen', chats: 'Deine Chats', hint: 'Deine Worte. Natürliches Englisch.', footer: 'Fehler sind möglich. Prüfe wichtige Informationen.'},
  es: {welcome: '¿En qué puedo ayudarte?', claudeWelcome: '¿En qué puedo ayudarte hoy?', placeholder: 'Escribe tu pregunta', newChat: 'Nuevo chat', search: 'Buscar chats', chats: 'Tus chats', hint: 'Tus palabras, en un inglés natural.', footer: 'Puede cometer errores. Comprueba la información importante.'},
  fr: {welcome: 'Comment puis-je vous aider ?', claudeWelcome: 'Comment puis-je vous aider aujourd’hui ?', placeholder: 'Posez votre question', newChat: 'Nouvelle discussion', search: 'Rechercher', chats: 'Vos discussions', hint: 'Vos mots, dans un anglais naturel.', footer: 'Des erreurs sont possibles. Vérifiez les informations importantes.'},
  it: {welcome: 'Come posso aiutarti?', claudeWelcome: 'Come posso aiutarti oggi?', placeholder: 'Scrivi la tua domanda', newChat: 'Nuova chat', search: 'Cerca nelle chat', chats: 'Le tue chat', hint: 'Le tue parole, in un inglese naturale.', footer: 'Può commettere errori. Verifica le informazioni importanti.'},
  ru: {welcome: 'Чем я могу помочь?', claudeWelcome: 'Чем я могу помочь сегодня?', placeholder: 'Введите свой вопрос', newChat: 'Новый чат', search: 'Поиск чатов', chats: 'Ваши чаты', hint: 'Ваши слова — на естественном английском.', footer: 'Возможны ошибки. Проверяйте важную информацию.'},
};

function panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}
function label(c: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, weight = '500', align: CanvasTextAlign = 'left', font = FONT) {
  c.font = `${weight} ${size}px ${font}`;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = 'alphabetic';
  c.fillText(value, x, y);
}
function graphemes(value: string, locale: string): string[] {
  return Array.from(new Intl.Segmenter(locale, {granularity: 'grapheme'}).segment(value), part => part.segment);
}
/** Latin/Cyrillic words stay together; long words and CJK wrap at grapheme boundaries. */
function linesFor(c: CanvasRenderingContext2D, value: string, locale: string, maxWidth: number): string[] {
  const rows: string[] = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    const units = ['zh', 'ja', 'ko'].includes(locale)
      ? graphemes(paragraph, locale)
      : Array.from(new Intl.Segmenter(locale, {granularity: 'word'}).segment(paragraph), part => part.segment);
    for (const unit of units) {
      if (line && c.measureText(line + unit).width > maxWidth && !/^\s+$/.test(unit)) {
        rows.push(line.trimEnd());
        line = '';
      }
      if (c.measureText(unit).width <= maxWidth) {
        line += unit;
      } else {
        for (const glyph of graphemes(unit, locale)) {
          if (line && c.measureText(line + glyph).width > maxWidth) { rows.push(line.trimEnd()); line = ''; }
          line += glyph;
        }
      }
    }
    rows.push(line);
  }
  return rows;
}

/** Fixed 2800 × 1600 browser texture. All animation phases are controlled externally. */
export function drawLocalizedUI(canvas: HTMLCanvasElement, options: LocalizedUIOptions, logo: CanvasImageSource): void {
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) return;
  const locale = options.locale.toLowerCase().split(/[-_]/)[0];
  const copy = COPY[locale] ?? COPY.zh;
  const segmentationLocale = COPY[locale] ? locale : 'zh';
  const warm = options.host === 'Claude';
  const ink = warm ? '#373a35' : '#152033';
  const muted = warm ? '#88877e' : '#7c899b';
  c.clearRect(0, 0, W, H);
  c.save();
  c.beginPath(); c.roundRect(0, 0, W, H, 70); c.clip();
  panel(c, 0, 0, W, H, 0, warm ? '#faf9f5' : '#ffffff');
  const chrome = c.createLinearGradient(0, 0, 0, 130);
  chrome.addColorStop(0, '#f8fbff'); chrome.addColorStop(1, '#e9eff7');
  c.fillStyle = chrome; c.fillRect(0, 0, W, 130);
  ['#ff938c', '#f5c66e', '#80c8a0'].forEach((color, i) => {
    c.fillStyle = color; c.beginPath(); c.arc(82 + i * 58, 65, 15, 0, Math.PI * 2); c.fill();
  });
  panel(c, 670, 26, 1460, 78, 30, '#f8fbfe');
  label(c, warm ? 'claude.ai' : 'chatgpt.com', 1400, 81, 35, '#62718c', '400', 'center');
  c.drawImage(logo,2452,31,71,71);
  c.strokeStyle = '#d8e1ee'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 131); c.lineTo(W, 131); c.stroke();

  panel(c, 0, 132, 455, H - 132, 0, warm ? '#efeee7' : '#f1f5fa');
  label(c, options.host, 54, 249, 56, ink, '650', 'left', warm ? 'Georgia, serif' : FONT);
  label(c, '☰', 356, 245, 48, muted);
  panel(c, 35, 304, 385, 104, 25, warm ? '#e5e2d9' : '#e1e9f4');
  label(c, '+', 60, 372, 53, ink);
  label(c, copy.newChat, 120, 371, 37, ink, '600');
  c.strokeStyle = muted; c.lineWidth = 4; c.beginPath(); c.arc(79, 473, 16, 0, Math.PI * 2); c.moveTo(91, 486); c.lineTo(104, 499); c.stroke();
  label(c, copy.search, 120, 489, 36, ink);
  label(c, copy.chats, 55, 634, 33, muted);
  [718, 786, 854].forEach((y, i) => panel(c, 56, y, [298, 243, 273][i], 17, 8, warm ? '#dfddd4' : '#dce4ee'));
  panel(c, 51, 1450, 64, 64, 32, warm ? '#ddd4c6' : '#dce6f6');
  label(c, 'A', 83, 1495, 34, muted, '500', 'center');

  label(c, options.host, 519, 246, 48, ink, '600', 'left', warm ? 'Georgia, serif' : FONT);
  panel(c, 2610, 181, 86, 86, 43, warm ? '#eadfd2' : '#e7eef9');
  label(c, 'A', 2653, 238, 40, muted, '500', 'center');
  const center = 1627;
  const welcome = warm ? copy.claudeWelcome : copy.welcome;
  const welcomeFont = warm && !['zh', 'ja', 'ko'].includes(locale) ? 'Georgia, serif' : FONT;
  let headingSize = warm ? 99 : 107;
  c.font = `${warm ? '500' : '600'} ${headingSize}px ${welcomeFont}`;
  while (c.measureText(welcome).width > 2100 && headingSize > 70) { headingSize -= 2; c.font = `${warm ? '500' : '600'} ${headingSize}px ${welcomeFont}`; }
  label(c, welcome, center, 575, headingSize, ink, warm ? '500' : '600', 'center', welcomeFont);
  label(c, copy.hint, center, 668, 41, muted, '400', 'center');

  const x = 555, y = 795, width = 2144, height = 535;
  c.shadowColor = 'rgba(52,69,97,.10)'; c.shadowBlur = 55; c.shadowOffsetY = 22;
  panel(c, x, y, width, height, 62, warm ? '#ffffff' : '#f8fafc');
  c.shadowBlur = 0; c.shadowOffsetY = 0;
  if (options.focused) {
    c.strokeStyle = 'rgba(65,112,215,.14)'; c.lineWidth = 15;
    c.beginPath(); c.roundRect(x - 3, y - 3, width + 6, height + 6, 65); c.stroke();
  }
  c.strokeStyle = options.focused ? '#91afe6' : warm ? '#deddd6' : '#d6dfeb';
  c.lineWidth = options.focused ? 4 : 3; c.beginPath(); c.roundRect(x, y, width, height, 62); c.stroke();

  const textX = 650, baseline = 972, maxWidth = 1948;
  let size = 116;
  c.font = `500 ${size}px ${FONT}`;
  let rows = linesFor(c, options.value, segmentationLocale, maxWidth);
  while (rows.length > 2 && size > 72) {
    size -= 2; c.font = `500 ${size}px ${FONT}`;
    rows = linesFor(c, options.value, segmentationLocale, maxWidth);
  }
  if (!options.value) label(c, copy.placeholder, textX, baseline, 98, '#a1aab6', '400');
  else rows.forEach((row, i) => label(c, row, textX, baseline + i * size * 1.30, size, ink));
  if (options.focused && options.caret) {
    c.font = `500 ${size}px ${FONT}`;
    const last = rows[rows.length - 1] ?? '';
    const endX = textX + c.measureText(last).width + 5;
    const endY = baseline + (rows.length - 1) * size * 1.30;
    panel(c, endX, endY - size * .86, 5, size * 1.05, 2, '#4269c5');
  }
  label(c, '+', 653, 1250, 79, '#57677e', '400');
  const buttonX = 2275, buttonY = 1175, buttonW = 245, buttonH = 110;
  if(options.showEN !== false){
  if (options.pressed) panel(c, buttonX - 13, buttonY - 13, buttonW + 26, buttonH + 26, 30, '#dce8fb');
  panel(c, buttonX, buttonY + (options.pressed ? 4 : 0), buttonW, buttonH, 23, options.pressed ? '#3158a7' : '#253249');
  label(c, '-> EN', buttonX + buttonW / 2, 1250 + (options.pressed ? 4 : 0), 55, '#ffffff', '600', 'center');
  }
  c.fillStyle = warm ? '#c97956' : '#1d2939'; c.beginPath(); c.arc(2600, 1230, 53, 0, Math.PI * 2); c.fill();
  label(c, '↑', 2600, 1257, 70, '#ffffff', '500', 'center');
  label(c, `${options.host} · ${copy.footer}`, center, 1467, 32, muted, '400', 'center');
  c.restore();
}

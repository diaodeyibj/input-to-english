import { chatgptAdapter } from './chatgpt';
import { claudeAdapter } from './claude';
import { geminiAdapter } from './gemini';
import { xAdapter } from './x';
import type { SiteAdapter } from './editor-adapter';

export function selectSiteAdapter(hostname: string): SiteAdapter | null {
  switch (hostname.toLowerCase()) {
    case 'chatgpt.com': return chatgptAdapter;
    case 'claude.ai': return claudeAdapter;
    case 'gemini.google.com': return geminiAdapter;
    case 'x.com': return xAdapter;
    default: return null;
  }
}

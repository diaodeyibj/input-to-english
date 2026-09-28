import { chatgptAdapter } from './chatgpt';
import { claudeAdapter } from './claude';
import type { SiteAdapter } from './editor-adapter';

export function selectSiteAdapter(hostname: string): SiteAdapter | null {
  switch (hostname.toLowerCase()) {
    case 'chatgpt.com': return chatgptAdapter;
    case 'claude.ai': return claudeAdapter;
    default: return null;
  }
}

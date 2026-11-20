import '../ui/tokens.css';
import '../ui/settings.css';
import type { Settings } from '../core/settings';
import { ChromeSettings } from '../ui/chrome-settings';
import { mountSettings } from '../ui/settings-page';
import { applyTheme, followSystemTheme } from '../ui/theme';

const root = document.getElementById('app') ?? document.body;
let theme: Settings['theme'] = 'system';
followSystemTheme(() => theme);

async function main(): Promise<void> {
  const page = await mountSettings(root, new ChromeSettings(), {
    version: chrome.runtime.getManifest().version,
    onChange: (settings) => {
      theme = settings.theme;
      applyTheme(theme);
    },
  });
  // Chrome tells us whether ATO is pinned, and when that changes; only the user can change it.
  const action = chrome.action as typeof chrome.action & {
    getUserSettings(): Promise<{ isOnToolbar: boolean }>;
    onUserSettingsChanged?: chrome.events.Event<(s: { isOnToolbar?: boolean }) => void>;
  };
  page.setPinned((await action.getUserSettings()).isOnToolbar);
  action.onUserSettingsChanged?.addListener((s) => {
    if (s.isOnToolbar !== undefined) page.setPinned(s.isOnToolbar);
  });
}

void main();

import { readSettings, type Settings } from '../core/settings';
import type { SettingsStore } from './settings-store';

/** All v3 settings live under one key, apart from the flat keys 2.x used. */
const KEY = 'settings';

/** Settings in `chrome.storage.sync`, so they follow the user across machines. */
export class ChromeSettings implements SettingsStore {
  async load(): Promise<Settings> {
    const stored = await chrome.storage.sync.get(KEY);
    return readSettings(stored[KEY]);
  }

  async save(settings: Settings): Promise<void> {
    await chrome.storage.sync.set({ [KEY]: settings });
  }

  subscribe(listener: (settings: Settings) => void): () => void {
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      const change = changes[KEY];
      if (area === 'sync' && change) listener(readSettings(change.newValue));
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }
}

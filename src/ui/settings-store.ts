import type { Settings } from '../core/settings';

/**
 * Where settings live. The extension stores them in `chrome.storage.sync`;
 * the screen gallery and tests keep them in memory.
 */
export interface SettingsStore {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
  /** Calls `listener` when settings change elsewhere (another page, another machine). */
  subscribe(listener: (settings: Settings) => void): () => void;
}

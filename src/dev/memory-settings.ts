import { DEFAULT_SETTINGS, readSettings, type Settings } from '../core/settings';
import type { SettingsStore } from '../ui/settings-store';

/** In-memory settings for the gallery and tests. Saves notify subscribers. */
export class MemorySettings implements SettingsStore {
  private listeners = new Set<(s: Settings) => void>();

  constructor(private settings: Settings = DEFAULT_SETTINGS) {}

  async load(): Promise<Settings> {
    return this.settings;
  }

  async save(settings: Settings): Promise<void> {
    this.settings = readSettings(settings);
    for (const listener of this.listeners) listener(this.settings);
  }

  subscribe(listener: (s: Settings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

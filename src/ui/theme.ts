import type { Settings, ThemeId } from '../core/settings';

export interface ThemeInfo {
  name: string;
  /** One line of personality for the picker. */
  tagline: string;
}

export const THEME_INFO: Record<Settings['theme'], ThemeInfo> = {
  system: { name: 'System', tagline: 'Paper by day, Graphite by night' },
  graphite: { name: 'Graphite', tagline: 'Calm, cool dark' },
  paper: { name: 'Paper', tagline: 'Quiet, warm light' },
  cyber: { name: 'Cyber', tagline: 'Neon grid, everything glows' },
  nebula: { name: 'Nebula', tagline: 'Violet deep space' },
  ember: { name: 'Ember', tagline: 'Campfire, low and warm' },
  neon: { name: 'Neon', tagline: 'Arcade after midnight' },
  lagoon: { name: 'Lagoon', tagline: 'Shallow water at noon' },
  sakura: { name: 'Sakura', tagline: 'Blossom and plum' },
  dune: { name: 'Dune', tagline: 'Sand, sun and terracotta' },
};

/** The theme a setting stands for right now (`system` follows the OS). */
export function resolveTheme(theme: Settings['theme'], prefersLight = matchMedia('(prefers-color-scheme: light)').matches): ThemeId {
  return theme === 'system' ? (prefersLight ? 'paper' : 'graphite') : theme;
}

/** Apply a theme setting to the page. */
export function applyTheme(theme: Settings['theme'], root: HTMLElement = document.documentElement): void {
  root.dataset.theme = resolveTheme(theme);
}

/**
 * Re-apply the theme when the OS switches light/dark, so `system` follows it on
 * a page that stays open. `current` reads the setting at that moment.
 */
export function followSystemTheme(current: () => Settings['theme'], root: HTMLElement = document.documentElement): () => void {
  const query = matchMedia('(prefers-color-scheme: light)');
  const onChange = () => applyTheme(current(), root);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

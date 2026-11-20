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

import type { Settings, ThemeId } from '../core/settings';

export interface ThemeInfo {
  name: string;
  /** One line of personality for the picker. */
  tagline: string;
  /** New in this release: listed first in the picker, with a badge. */
  isNew?: boolean;
  /** Follows the OS between a day and a night look of its own: its picker card shows both. */
  dayNight?: boolean;
}

export const THEME_INFO: Record<Settings['theme'], ThemeInfo> = {
  system: { name: 'System', tagline: 'Daylight by day, Graphite by night' },
  graphite: { name: 'Graphite', tagline: 'Calm, cool dark' },
  daylight: { name: 'Daylight', tagline: 'Neutral light, every signal clear' },
  paper: { name: 'Paper', tagline: 'Quiet, warm light' },
  onyx: { name: 'Onyx', tagline: 'True black, for OLED and late nights' },
  cyber: { name: 'Cyber', tagline: 'Neon grid, everything glows' },
  neon: { name: 'Neon', tagline: 'Arcade after midnight' },
  poster: { name: 'Poster', tagline: 'Black, white and signal red' },
  riso: { name: 'Riso', tagline: 'Two inks, a little off register' },
  nebula: { name: 'Nebula', tagline: 'Violet deep space' },
  ember: { name: 'Ember', tagline: 'Campfire, low and warm' },
  lagoon: { name: 'Lagoon', tagline: 'Shallow water at noon' },
  sakura: { name: 'Sakura', tagline: 'Blossom and plum' },
  dune: { name: 'Dune', tagline: 'Sand, sun and terracotta' },
  'missing-link': { name: 'Missing Link', tagline: 'Fields by day, dungeons by night', isNew: true, dayNight: true },
};

/** The theme a setting stands for right now (`system` follows the OS). */
export function resolveTheme(theme: Settings['theme'], prefersLight = matchMedia('(prefers-color-scheme: light)').matches): ThemeId {
  return theme === 'system' ? (prefersLight ? 'daylight' : 'graphite') : theme;
}

/** The picker's order: what's new first, then the rest as listed. */
export function pickerOrder(themes: readonly Settings['theme'][]): Settings['theme'][] {
  return [...themes.filter((t) => THEME_INFO[t].isNew), ...themes.filter((t) => !THEME_INFO[t].isNew)];
}

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

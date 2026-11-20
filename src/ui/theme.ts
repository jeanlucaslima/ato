import type { Settings } from '../core/settings';

/** Apply a theme setting to the page. Dark is the stylesheet default. */
export function applyTheme(theme: Settings['theme'], root: HTMLElement = document.documentElement): void {
  const light = theme === 'light' || (theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
  if (light) root.dataset.theme = 'light';
  else delete root.dataset.theme;
}

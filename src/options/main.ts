import '../ui/tokens.css';
import '../ui/settings.css';
import type { Settings } from '../core/settings';
import { ChromeSettings } from '../ui/chrome-settings';
import { mountSettings } from '../ui/settings-page';
import { applyTheme, followSystemTheme, resolveTheme } from '../ui/theme';

const root = document.getElementById('app') ?? document.body;

/** Does the theme go through doors (it sets --screen-door), and can this browser show one? */
function wantsDoor(next: Settings['theme']): boolean {
  if (typeof document.startViewTransition !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const probe = document.createElement('div');
  probe.dataset.theme = resolveTheme(next);
  probe.hidden = true;
  document.body.append(probe);
  const door = getComputedStyle(probe).getPropertyValue('--screen-door').trim() === 'iris';
  probe.remove();
  return door;
}
let theme: Settings['theme'] = 'system';
followSystemTheme(() => theme);

async function main(): Promise<void> {
  const page = await mountSettings(root, new ChromeSettings(), {
    version: chrome.runtime.getManifest().version_name ?? chrome.runtime.getManifest().version,
    onChange: (settings) => {
      const before = resolveTheme(theme);
      theme = settings.theme;
      // Picking a theme with a door (Missing Link) opens it through the door: the page closes into a dot, then opens.
      if (before !== resolveTheme(theme) && wantsDoor(theme)) {
        const html = document.documentElement;
        html.classList.add('is-door');
        const t = document.startViewTransition!(() => applyTheme(theme));
        void t.finished.finally(() => html.classList.remove('is-door'));
      } else applyTheme(theme);
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

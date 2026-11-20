/**
 * The options page: renders settings and saves each change as it happens.
 * Rendering is a pure function of `SettingsView`; `mountSettings` owns the
 * state and re-renders with `morph` so focus survives a change.
 */
import { BADGE_COLORS, CHOICES, readSettings, type BadgeColor, type ChoiceKey, type Settings, type ThemeId, type ToggleKey } from '../core/settings';
import { logoSvg } from './logo-svg';
import { THEME_INFO } from './theme';
import { cls, h } from './dom';
import { attachSpin, icosahedron } from './icosahedron';
import { morph } from './morph';
import type { SettingsStore } from './settings-store';

export interface SettingsView {
  settings: Settings;
  version: string;
  /** A change has been saved since the page opened. */
  saved: boolean;
}

function text(id: string, title: string, note?: string): HTMLElement {
  return h('div', { class: 'setting-text' }, h('span', { class: 'setting-title', id }, title), note && h('p', { class: 'setting-note' }, note));
}

function choice<K extends ChoiceKey>(s: Settings, key: K, title: string, labels: Record<Settings[K], string>, note?: string): HTMLElement {
  const id = `setting-${key}`;
  return h(
    'div',
    { class: 'setting' },
    text(id, title, note),
    h(
      'div',
      { class: 'choice', role: 'radiogroup', 'aria-labelledby': id },
      CHOICES[key].map((value) =>
        h('label', { class: 'choice-opt' }, h('input', { type: 'radio', name: key, value, checked: s[key] === value }), h('span', null, labels[value])),
      ),
    ),
  );
}

function toggle(s: Settings, key: ToggleKey, title: string, note: string): HTMLElement {
  const id = `setting-${key}`;
  return h(
    'label',
    { class: 'setting setting--toggle' },
    text(id, title, note),
    h('input', { class: 'switch', type: 'checkbox', role: 'switch', name: key, checked: s[key], 'aria-labelledby': id }),
  );
}

function info(title: string, note: string, ...keys: string[]): HTMLElement {
  return h('div', { class: 'setting' }, text('', title, note), h('span', { class: 'keys' }, keys.map((k) => h('kbd', null, k))));
}

function section(title: string, note: string | null, ...rows: HTMLElement[]): HTMLElement {
  return h('section', null, h('h2', null, title), note && h('p', { class: 'section-note' }, note), h('div', { class: 'group' }, rows));
}

// --- Theme picker -------------------------------------------------------------

/** A tiny popup drawn in a theme's own colours: the card wears that theme. */
function miniPopup(theme: ThemeId): HTMLElement {
  const row = (variant: string, cursor = false) =>
    h('span', { class: cls('mini-row', cursor && 'is-cursor') }, h('span', { class: `mini-fav mini-fav--${variant}` }), h('span', { class: `mini-line mini-line--${variant}` }));
  return h(
    'span',
    { class: 'mini', 'data-theme': theme },
    h('span', { class: 'mini-search' }, h('span', { class: 'mini-caret' })),
    h('span', { class: 'mini-strip' }, h('span', { class: 'mini-dot' }), h('span', { class: 'mini-strip-line' })),
    row('a', true),
    row('b'),
    row('c'),
  );
}

function themeCard(s: Settings, value: Settings['theme']): HTMLElement {
  const info = THEME_INFO[value];
  return h(
    'label',
    { class: 'theme-card' },
    h('input', { type: 'radio', name: 'theme', value, checked: s.theme === value }),
    h('span', { class: cls('theme-preview', value === 'system' && 'theme-preview--split'), 'aria-hidden': 'true' }, value === 'system' ? [miniPopup('graphite'), miniPopup('paper')] : miniPopup(value)),
    h('span', { class: 'theme-name' }, info.name),
    h('span', { class: 'theme-tag' }, info.tagline),
  );
}

function themePicker(s: Settings): HTMLElement {
  return h(
    'section',
    null,
    h('h2', { id: 'theme-title' }, 'Theme'),
    h('div', { class: 'theme-grid', role: 'radiogroup', 'aria-labelledby': 'theme-title' }, CHOICES.theme.map((t) => themeCard(s, t))),
  );
}

// --- Toolbar badge ------------------------------------------------------------

const BADGE_COLOR_NAME: Record<BadgeColor, string> = {
  '#dc2626': 'Red',
  '#ea580c': 'Orange',
  '#ca8a04': 'Mustard',
  '#16a34a': 'Green',
  '#0891b2': 'Teal',
  '#2563eb': 'Blue',
  '#7c3aed': 'Violet',
  '#db2777': 'Pink',
  '#475569': 'Slate',
};

/** The sample count the preview shows for each badge mode. */
const SAMPLE: Record<Settings['badge'], string> = { duplicates: '4', all: '128', off: '' };

const BADGE_MARK = logoSvg({ size: 18, spin: 100, pitch: -18, background: null, color: 'currentColor', weight: 2.6, dashes: 2, hiddenOpacity: 0.5 });

function badgePreview(s: Settings): HTMLElement {
  const mark = h('span', { class: 'tb-icon tb-icon--ato' });
  mark.innerHTML = BADGE_MARK; // generated, trusted markup
  return h(
    'div',
    { class: 'setting badge-preview' },
    text('badge-preview-title', 'Preview', s.badge === 'off' ? 'No number on the icon.' : s.badge === 'duplicates' ? 'Counts duplicate tabs; hidden when there are none.' : 'Counts every open tab.'),
    h(
      'div',
      { class: 'toolbar-mock', 'aria-hidden': 'true' },
      h('span', { class: 'tb-icon' }),
      h('span', { class: 'tb-icon' }),
      h('span', { class: 'tb-slot' }, mark, s.badge !== 'off' && h('span', { class: 'tb-badge', style: `background:${s.badgeColor}` }, SAMPLE[s.badge])),
      h('span', { class: 'tb-icon' }),
    ),
  );
}

function swatches(s: Settings): HTMLElement {
  const off = s.badge === 'off';
  return h(
    'div',
    { class: cls('setting', off && 'is-disabled') },
    text('setting-badgeColor', 'Color'),
    h(
      'div',
      { class: 'swatches', role: 'radiogroup', 'aria-labelledby': 'setting-badgeColor' },
      BADGE_COLORS.map((c) =>
        h(
          'label',
          { class: 'swatch', title: BADGE_COLOR_NAME[c] },
          h('input', { type: 'radio', name: 'badgeColor', value: c, checked: s.badgeColor === c, disabled: off, 'aria-label': BADGE_COLOR_NAME[c] }),
          h('span', { style: `background:${c}` }),
        ),
      ),
    ),
  );
}

/** Render the whole settings page. Pure: same view, same DOM. */
export function renderSettings({ settings: s, version, saved }: SettingsView): HTMLElement {
  return h(
    'div',
    { class: 'settings' },
    h(
      'header',
      { class: 'settings-head' },
      icosahedron(72),
      h('h1', null, 'ATO'),
      h('p', null, 'Advanced Tab Organizer · Settings'),
      h('span', { class: cls('saved', saved && 'is-saved'), role: 'status' }, saved ? 'Saved' : 'Changes save automatically'),
    ),
    section(
      'Closing duplicates',
      'The tab you’re on in each window is always kept.',
      choice(s, 'keep', 'Keep', { oldest: 'Oldest copy', newest: 'Newest copy' }, 'When no copy is protected, this one stays and the rest close.'),
      toggle(s, 'protectPinned', 'Protect pinned tabs', 'Pinned copies are never closed.'),
      toggle(s, 'protectGroups', 'Protect tab groups', 'Copies inside a tab group are never closed.'),
    ),
    section(
      'When the popup opens',
      null,
      choice(s, 'view', 'Show', { tabs: 'Tabs', sites: 'Sites' }),
      choice(s, 'scope', 'From', { all: 'All windows', current: 'This window' }, 'Search always covers every window.'),
    ),
    themePicker(s),
    section(
      'Toolbar badge',
      'Preview: the number on the toolbar icon arrives with the background worker.',
      badgePreview(s),
      choice(s, 'badge', 'Shows', { duplicates: 'Duplicates', all: 'All tabs', off: 'Off' }),
      swatches(s),
    ),
    section(
      'Keyboard',
      null,
      info('Open ATO', 'Change it in chrome://extensions/shortcuts.', '⌘U', 'Ctrl+U'),
      info('Every shortcut', 'Press ? in the popup to see them all.', '?'),
    ),
    h(
      'footer',
      { class: 'settings-foot' },
      h('span', null, `ATO ${version}`),
      h('a', { href: 'https://github.com/jeanlucaslima/ato', target: '_blank', rel: 'noopener' }, 'Source on GitHub ↗'),
    ),
  );
}

export interface SettingsPage {
  destroy(): void;
}

export interface SettingsOptions {
  version: string;
  /** Runs after load and after every change, e.g. to apply the theme. */
  onChange?: (settings: Settings) => void;
}

export async function mountSettings(container: HTMLElement, store: SettingsStore, options: SettingsOptions): Promise<SettingsPage> {
  let settings = await store.load();
  let saved = false;
  let root: HTMLElement | null = null;

  function render(): void {
    const next = renderSettings({ settings, version: options.version, saved });
    if (root) morph(root, next);
    else container.replaceChildren((root = next));
  }

  function set(next: Settings): void {
    settings = next;
    render();
    options.onChange?.(settings);
  }

  const onChange = (event: Event) => {
    const el = event.target as HTMLInputElement;
    if (!el.name) return;
    saved = true;
    set(readSettings({ ...settings, [el.name]: el.type === 'checkbox' ? el.checked : el.value }));
    void store.save(settings);
  };

  container.addEventListener('change', onChange);
  const unsubscribe = store.subscribe(set);
  set(settings);
  const logo = container.querySelector<HTMLElement>('.ico');
  const stopSpin = logo ? attachSpin(logo) : () => {};

  return {
    destroy() {
      stopSpin();
      unsubscribe();
      container.removeEventListener('change', onChange);
    },
  };
}

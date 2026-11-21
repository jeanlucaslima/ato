/**
 * The options page: renders settings and saves each change as it happens.
 * Rendering is a pure function of `SettingsView`; `mountSettings` owns the
 * state and re-renders with `morph` so focus survives a change.
 */
import { BADGE_COLORS, CHOICES, readSettings, type BadgeColor, type ChoiceKey, type Settings, type ThemeId, type ToggleKey } from '../core/settings';
import { logoSvg } from './logo-svg';
import { THEME_INFO } from './theme';
import { cls, h } from './dom';
import { icon } from './icons';
import { attachSpin, icosahedron } from './icosahedron';
import { morph } from './morph';
import type { SettingsStore } from './settings-store';

export interface SettingsView {
  settings: Settings;
  version: string;
  /** Whether ATO's icon is pinned to the toolbar; `null` when unknown. Only the user can pin it. */
  pinned?: boolean | null;
  /** The theme grid shows every theme (otherwise a row and a half). */
  themesOpen?: boolean;
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

/** Two URLs and what the chosen rule makes of them; the part it ignores is dimmed. */
const MATCH_EXAMPLES: Record<Settings['match'], { urls: [string, string][]; same: boolean }> = {
  exact: { urls: [['example.com/docs#intro', ''], ['example.com/docs#setup', '']], same: false },
  ignoreHash: { urls: [['example.com/docs', '#intro'], ['example.com/docs', '#setup']], same: true },
  ignoreQuery: { urls: [['example.com/docs', '?lang=en'], ['example.com/docs', '?lang=pt']], same: true },
  ignoreBoth: { urls: [['example.com/docs', '?lang=en#intro'], ['example.com/docs', '?lang=pt#setup']], same: true },
};

function matchExample(match: Settings['match']): HTMLElement {
  const { urls, same } = MATCH_EXAMPLES[match];
  return h(
    'div',
    { class: 'match-example', 'aria-live': 'polite' },
    h('div', { class: 'match-urls' }, urls.map(([kept, ignored]) => h('code', null, kept, ignored && h('span', { class: 'match-ignored' }, ignored)))),
    h('p', { class: cls('match-verdict', same && 'is-same') }, same ? 'Same page: one copy closes' : 'Different pages: both stay open'),
  );
}

function matchSetting(s: Settings): HTMLElement {
  const row = choice(
    s,
    'match',
    'Same page when',
    { exact: 'Whole URL matches', ignoreHash: 'Ignoring #hash', ignoreQuery: 'Ignoring ?query', ignoreBoth: 'Ignoring both' },
    'Which tabs count as copies of each other.',
  );
  row.classList.add('setting--stack');
  row.append(matchExample(s.match));
  return row;
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

/** Cards fully shown while the grid is folded: the first row (the half row below stays clickable). */
const FOLDED_CARDS = 6;

/**
 * Folded, the grid shows a row and a half and fades out; a button opens the
 * rest. Cards out of sight are inert so the keyboard can't land on them.
 */
function themePicker(s: Settings, open: boolean): HTMLElement {
  const current = THEME_INFO[s.theme].name;
  const hiddenCurrent = !open && CHOICES.theme.indexOf(s.theme) >= FOLDED_CARDS;
  return h(
    'section',
    null,
    h('h2', { id: 'theme-title' }, 'Theme'),
    h(
      'div',
      { class: cls('theme-fold', open && 'is-open'), id: 'theme-fold' },
      h(
        'div',
        { class: 'theme-grid', role: 'radiogroup', 'aria-labelledby': 'theme-title' },
        CHOICES.theme.map((t, i) => {
          const card = themeCard(s, t);
          if (!open && i >= FOLDED_CARDS) card.setAttribute('inert', '');
          return card;
        }),
      ),
    ),
    h(
      'button',
      { class: 'theme-more', type: 'button', 'data-action': 'toggle-themes', 'aria-expanded': String(open), 'aria-controls': 'theme-fold' },
      open ? 'Show fewer' : `Show all ${CHOICES.theme.length} themes`,
      hiddenCurrent && h('span', { class: 'theme-more-current' }, ` · using ${current}`),
      icon('chevron', 10),
    ),
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

/**
 * Pinning is the user's call: Chrome lets an extension see whether it's pinned
 * but not pin itself. So this shows the state and how to change it.
 */
function pinRow(pinned: boolean | null): HTMLElement {
  return h(
    'div',
    { class: 'setting' },
    text(
      'setting-pin',
      'Keep ATO on the toolbar',
      pinned
        ? 'Pinned: ATO and its badge stay in view. Unpin it from the puzzle-piece menu.'
        : 'Only you can pin it: open the puzzle-piece menu next to the address bar and click the pin beside ATO. The badge only shows while pinned.',
    ),
    h('span', { class: cls('pin-status', pinned && 'is-pinned') }, icon(pinned ? 'pin' : 'puzzle', 14), pinned === null ? 'Unknown' : pinned ? 'Pinned' : 'Not pinned'),
  );
}

function badgePreview(s: Settings, pinned: boolean | null): HTMLElement {
  const mark = h('span', { class: 'tb-icon tb-icon--ato' });
  mark.innerHTML = BADGE_MARK; // generated, trusted markup
  const hidden = pinned === false;
  return h(
    'div',
    { class: 'setting badge-preview' },
    text(
      'badge-preview-title',
      'Preview',
      hidden
        ? 'Unpinned: ATO waits in the puzzle-piece menu, so no badge shows.'
        : s.badge === 'off'
          ? 'No number on the icon.'
          : s.badge === 'duplicates'
            ? 'Counts duplicate tabs; hidden when there are none.'
            : 'Counts every open tab.',
    ),
    h(
      'div',
      { class: 'toolbar-mock', 'aria-hidden': 'true' },
      h('span', { class: 'tb-icon' }),
      h('span', { class: 'tb-icon' }),
      hidden
        ? h('span', { class: 'tb-slot tb-slot--menu' }, icon('puzzle', 16))
        : h('span', { class: 'tb-slot' }, mark, s.badge !== 'off' && h('span', { class: 'tb-badge', style: `background:${s.badgeColor}` }, SAMPLE[s.badge])),
      !hidden && h('span', { class: 'tb-icon tb-icon--menu' }, icon('puzzle', 14)),
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
export function renderSettings({ settings: s, version, saved, pinned = null, themesOpen = false }: SettingsView): HTMLElement {
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
      matchSetting(s),
      choice(s, 'keep', 'Keep', { oldest: 'Oldest copy', newest: 'Newest copy' }, 'When no copy is protected, this one stays and the rest close.'),
      toggle(s, 'protectPinned', 'Protect pinned tabs', 'Pinned copies are never closed.'),
      toggle(s, 'protectGroups', 'Protect tab groups', 'Copies inside a tab group are never closed.'),
    ),
    section(
      'When the popup opens',
      null,
      choice(s, 'view', 'Show', { tabs: 'Tabs', sites: 'Sites', windows: 'Windows' }),
      choice(s, 'scope', 'From', { all: 'All windows', current: 'This window' }, 'Search always covers every window.'),
    ),
    themePicker(s, themesOpen),
    section(
      'Toolbar',
      'Preview: the number on the toolbar icon arrives with the background worker.',
      pinRow(pinned),
      badgePreview(s, pinned),
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
  /** Tell the page whether ATO is pinned (it changes outside the page). */
  setPinned(pinned: boolean | null): void;
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
  let pinned: boolean | null = null;
  let themesOpen = false;
  let root: HTMLElement | null = null;

  function render(): void {
    const next = renderSettings({ settings, version: options.version, saved, pinned, themesOpen });
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

  const onClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('[data-action="toggle-themes"]')) {
      themesOpen = !themesOpen;
      render();
    }
  };

  container.addEventListener('change', onChange);
  container.addEventListener('click', onClick);
  const unsubscribe = store.subscribe(set);
  set(settings);
  const logo = container.querySelector<HTMLElement>('.ico');
  const stopSpin = logo ? attachSpin(logo) : () => {};

  return {
    setPinned(next) {
      pinned = next;
      render();
    },
    destroy() {
      stopSpin();
      unsubscribe();
      container.removeEventListener('change', onChange);
      container.removeEventListener('click', onClick);
    },
  };
}
